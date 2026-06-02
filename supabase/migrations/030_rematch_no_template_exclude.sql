-- Rematch should pick the best template again, not force a different one.
-- Excluding the current template is only appropriate for scheduled rotation.

CREATE OR REPLACE FUNCTION public.assign_or_rotate_plans(
    p_profile_id UUID,
    p_outlet_id UUID,
    p_form_name TEXT DEFAULT 'basic_info',
    p_reason TEXT DEFAULT 'initial',
    p_triggered_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr                   questions_responses%ROWTYPE;
  v_profile              profiles%ROWTYPE;
  v_bmi                  numeric(5,2);
  v_age                  integer;
  v_plan                 plan_templates%ROWTYPE;
  v_ptype                text;
  v_existing             customer_plan_assignments%ROWTYPE;
  v_new_id               uuid;
  v_new_tier             text;
  v_comp_rate            numeric(5,2);
  v_seq                  integer;
  v_config               plan_progression_config%ROWTYPE;
  v_result               jsonb := '{"actions": []}';
  v_ex_id                uuid;
  v_di_id                uuid;
  v_fitness_goal_label   text;
  v_diet_type_label      text;
  v_exclude_template_id  uuid;
BEGIN
  IF public.intake_sections_complete(p_profile_id, p_outlet_id) THEN
    PERFORM public.compute_member_intake_score(p_profile_id, p_outlet_id);
  END IF;

  SELECT * INTO v_qr
    FROM questions_responses
   WHERE profile_id = p_profile_id
     AND outlet_id  = p_outlet_id
     AND form_name  = p_form_name
     AND is_complete = true
     AND deleted_at IS NULL
   ORDER BY COALESCE(completed_at, updated_at, submitted_at) DESC
   LIMIT 1;

  IF v_qr.id IS NULL AND p_form_name <> 'basic_info' THEN
    SELECT * INTO v_qr
      FROM questions_responses
     WHERE profile_id = p_profile_id
       AND outlet_id  = p_outlet_id
       AND form_name  = 'basic_info'
       AND is_complete = true
       AND deleted_at IS NULL
     ORDER BY COALESCE(completed_at, updated_at, submitted_at) DESC
     LIMIT 1;
  END IF;

  v_fitness_goal_label := v_qr.answers_json ->> 'fitness_goal';

  SELECT qr.answers_json ->> 'diet_type'
    INTO v_diet_type_label
    FROM questions_responses qr
   WHERE qr.profile_id = p_profile_id
     AND qr.outlet_id  = p_outlet_id
     AND qr.form_name  = 'diet_preferences'
     AND qr.is_complete = TRUE
     AND qr.deleted_at IS NULL
   LIMIT 1;

  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;

  v_age := EXTRACT(YEAR FROM age(v_profile.date_of_birth))::integer;

  IF v_profile.height_cm IS NOT NULL AND v_profile.weight_kg IS NOT NULL
     AND v_profile.height_cm > 0 THEN
    v_bmi := v_profile.weight_kg / ((v_profile.height_cm / 100.0) ^ 2);
  END IF;

  FOREACH v_ptype IN ARRAY ARRAY['exercise', 'diet'] LOOP

    SELECT * INTO v_config
      FROM plan_progression_config
     WHERE plan_type = v_ptype
       AND is_active = true
       AND (outlet_id = p_outlet_id OR outlet_id IS NULL)
     ORDER BY CASE WHEN outlet_id IS NOT NULL THEN 0 ELSE 1 END
     LIMIT 1;

    SELECT * INTO v_existing
      FROM customer_plan_assignments
     WHERE profile_id = p_profile_id
       AND outlet_id  = p_outlet_id
       AND plan_type  = v_ptype
       AND status     = 'active'
       AND deleted_at IS NULL
     LIMIT 1;

    v_new_tier := 'beginner';
    v_comp_rate := NULL;

    IF v_existing.id IS NOT NULL THEN

      SELECT
        ROUND(
          100.0 * COUNT(CASE WHEN ppl.id IS NOT NULL THEN 1 END)
          / GREATEST(
              (SELECT COUNT(*) FROM plan_days pd2
               JOIN plan_weeks pw2 ON pw2.id = pd2.plan_week_id
               WHERE pw2.plan_template_id = v_existing.plan_template_id
                 AND NOT pd2.is_rest_day),
              1),
          2)
      INTO v_comp_rate
      FROM generate_series(v_existing.start_date, CURRENT_DATE - 1, '1 day'::interval) gs(d)
      LEFT JOIN plan_progress_logs ppl
        ON ppl.assignment_id = v_existing.id
       AND ppl.log_date      = gs.d::date;

      v_comp_rate := COALESCE(v_comp_rate, 0);

      IF v_comp_rate >= COALESCE(v_config.tier_up_threshold, 75) THEN
        v_new_tier := CASE v_existing.progression_tier
          WHEN 'beginner'     THEN 'intermediate'
          WHEN 'intermediate' THEN 'advanced'
          ELSE                     'advanced'
        END;
      ELSIF v_comp_rate < COALESCE(v_config.tier_down_threshold, 30) THEN
        v_new_tier := CASE v_existing.progression_tier
          WHEN 'advanced'     THEN 'intermediate'
          WHEN 'intermediate' THEN 'beginner'
          ELSE                     'beginner'
        END;
      ELSE
        v_new_tier := v_existing.progression_tier;
      END IF;

    ELSE
      v_new_tier := CASE
        WHEN COALESCE(v_qr.intake_score, 0) >= 30 THEN 'advanced'
        WHEN COALESCE(v_qr.intake_score, 0) >= 20 THEN 'intermediate'
        ELSE 'beginner'
      END;
    END IF;

    -- Only rotation should avoid re-picking the same template
    v_exclude_template_id := CASE
      WHEN p_reason = 'rotation' THEN v_existing.plan_template_id
      ELSE NULL
    END;

    v_plan := public.pick_plan_template(
      p_outlet_id,
      v_ptype,
      v_new_tier,
      v_fitness_goal_label,
      v_profile.gender::text,
      v_age,
      v_bmi,
      COALESCE(v_qr.intake_score, 0),
      v_exclude_template_id,
      CASE WHEN v_ptype = 'diet' THEN v_diet_type_label ELSE NULL END
    );

    IF v_plan.id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_existing.id IS NOT NULL THEN
      UPDATE customer_plan_assignments
         SET status          = CASE WHEN p_reason = 'rotation' THEN 'completed' ELSE 'cancelled' END,
             completion_rate = v_comp_rate,
             weeks_completed = GREATEST(v_existing.current_week - 1, 0),
             completed_at    = CASE WHEN p_reason = 'rotation' THEN NOW() ELSE NULL END,
             deleted_at      = NOW(),
             updated_at      = NOW()
       WHERE id = v_existing.id;

      INSERT INTO assignment_events
        (assignment_id, profile_id, outlet_id, event_type, event_data, triggered_by)
      VALUES (
        v_existing.id, p_profile_id, p_outlet_id,
        CASE WHEN p_reason = 'rotation' THEN 'completed' ELSE 'cancelled' END,
        jsonb_build_object(
          'reason', p_reason,
          'completion_rate', v_comp_rate,
          'new_assignment_tier', v_new_tier,
          'superseded_by_rematch', true,
          'intake_fitness_goal', v_fitness_goal_label
        ),
        p_triggered_by
      );
    END IF;

    SELECT COALESCE(MAX(plan_sequence), 0) + 1 INTO v_seq
      FROM customer_plan_assignments
     WHERE profile_id = p_profile_id
       AND outlet_id  = p_outlet_id
       AND plan_type  = v_ptype;

    INSERT INTO customer_plan_assignments (
      profile_id, outlet_id, plan_template_id, plan_type,
      matched_score, matched_vector, match_method,
      start_date, status, plan_sequence, progression_tier,
      rotation_reason, previous_assignment_id, assigned_by
    )
    VALUES (
      p_profile_id, p_outlet_id, v_plan.id, v_ptype,
      v_qr.intake_score, v_qr.score_vector,
      CASE WHEN p_triggered_by IS NOT NULL THEN 'manual' ELSE 'auto' END,
      CURRENT_DATE, 'active',
      v_seq, v_new_tier,
      p_reason,
      v_existing.id,
      p_triggered_by
    )
    RETURNING id INTO v_new_id;

    INSERT INTO assignment_events
      (assignment_id, profile_id, outlet_id, event_type, event_data, triggered_by)
    VALUES (
      v_new_id, p_profile_id, p_outlet_id, 'assigned',
      jsonb_build_object(
        'plan_template_id', v_plan.id,
        'plan_name', v_plan.name,
        'plan_primary_goal', v_plan.primary_goal,
        'tier', v_new_tier,
        'reason', p_reason,
        'score', v_qr.intake_score,
        'intake_fitness_goal', v_fitness_goal_label,
        'intake_diet_type', v_diet_type_label
      ),
      p_triggered_by
    );

    IF v_ptype = 'exercise' THEN v_ex_id := v_new_id; END IF;
    IF v_ptype = 'diet'     THEN v_di_id := v_new_id; END IF;

    v_result := v_result || jsonb_build_object(
      v_ptype || '_assignment_id', v_new_id,
      v_ptype || '_plan_name',     v_plan.name,
      v_ptype || '_tier',          v_new_tier,
      v_ptype || '_primary_goal',  v_plan.primary_goal
    );

  END LOOP;

  RETURN v_result || jsonb_build_object(
    'exercise_assignment_id', v_ex_id,
    'diet_assignment_id',     v_di_id,
    'intake_fitness_goal',    v_fitness_goal_label
  );
END;
$$;
