-- =============================================================================
-- Onboarding questionnaire: definitions + responses (multi-section intake)
--
-- Moderator notes:
-- - Platform defaults live in question_definitions where outlet_id IS NULL.
-- - Branch-specific rows override/extend definitions for that outlet_id (merged in the app layer).
-- - responses: UNIQUE (profile_id, outlet_id, form_name).
-- =============================================================================

CREATE TYPE question_input_type AS ENUM (
    'select',
    'multiselect',
    'boolean',
    'text',
    'number',
    'scale'
);

CREATE TABLE question_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    form_name TEXT NOT NULL,
    question_key TEXT NOT NULL,
    label TEXT NOT NULL,
    helper_text TEXT,
    input_type question_input_type NOT NULL,
    options_json JSONB,
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    editable_by_customer BOOLEAN NOT NULL DEFAULT false,
    validation_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX question_definitions_platform_key
    ON question_definitions (form_name, question_key)
    WHERE outlet_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX question_definitions_outlet_key
    ON question_definitions (outlet_id, form_name, question_key)
    WHERE outlet_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_question_definitions_lookup
    ON question_definitions (form_name, display_order)
    WHERE is_active = true AND deleted_at IS NULL;

CREATE TABLE questions_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    form_name TEXT NOT NULL,
    answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    answered_by UUID REFERENCES profiles(id),
    last_edited_by UUID REFERENCES profiles(id),
    is_complete BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (profile_id, outlet_id, form_name)
);

CREATE INDEX idx_questions_responses_lookup
    ON questions_responses (profile_id, outlet_id)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION touch_question_definitions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_question_definitions
    BEFORE UPDATE ON question_definitions
    FOR EACH ROW EXECUTE FUNCTION touch_question_definitions_updated_at();

CREATE OR REPLACE FUNCTION touch_questions_responses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_questions_responses
    BEFORE UPDATE ON questions_responses
    FOR EACH ROW EXECUTE FUNCTION touch_questions_responses_updated_at();

ALTER TABLE question_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions_responses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION member_has_membership_at_outlet(p_profile_id UUID, p_outlet_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM gym_memberships gm
        WHERE gm.profile_id = p_profile_id
          AND gm.outlet_id = p_outlet_id
          AND gm.deleted_at IS NULL
    );
$$;

/** Branch leads may author outlet-scoped questionnaires (not trainers/reception). */
CREATE OR REPLACE FUNCTION branch_lead_definitions_writer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_assignments sa
        WHERE sa.profile_id = auth.uid()
          AND sa.revoked_at IS NULL
          AND sa.role IN ('gym_owner', 'branch_admin')
    );
$$;

-- question_definitions
CREATE POLICY "superadmin_question_definitions_all" ON question_definitions
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "question_definitions_select_managed" ON question_definitions
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND is_active = true
        AND (
            outlet_id IS NULL
            OR i_manage_outlet(outlet_id)
            OR outlet_id IN (
                SELECT gm.outlet_id FROM gym_memberships gm
                WHERE gm.profile_id = auth.uid() AND gm.deleted_at IS NULL
            )
        )
    );

CREATE POLICY "question_definitions_insert_outlet" ON question_definitions
    FOR INSERT TO authenticated
    WITH CHECK (
        outlet_id IS NOT NULL
        AND i_manage_outlet(outlet_id)
        AND branch_lead_definitions_writer()
    );

CREATE POLICY "question_definitions_update_outlet" ON question_definitions
    FOR UPDATE TO authenticated
    USING (
        outlet_id IS NOT NULL
        AND deleted_at IS NULL
        AND i_manage_outlet(outlet_id)
        AND branch_lead_definitions_writer()
    )
    WITH CHECK (
        outlet_id IS NOT NULL
        AND i_manage_outlet(outlet_id)
        AND branch_lead_definitions_writer()
    );

-- questions_responses
CREATE POLICY "superadmin_questions_responses_all" ON questions_responses
    FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "staff_questions_responses_select" ON questions_responses
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND i_manage_outlet(outlet_id)
        AND member_has_membership_at_outlet(profile_id, outlet_id)
    );

CREATE POLICY "staff_questions_responses_insert" ON questions_responses
    FOR INSERT TO authenticated
    WITH CHECK (
        deleted_at IS NULL
        AND i_manage_outlet(outlet_id)
        AND member_has_membership_at_outlet(profile_id, outlet_id)
    );

CREATE POLICY "staff_questions_responses_update" ON questions_responses
    FOR UPDATE TO authenticated
    USING (
        deleted_at IS NULL
        AND i_manage_outlet(outlet_id)
        AND member_has_membership_at_outlet(profile_id, outlet_id)
    )
    WITH CHECK (
        deleted_at IS NULL
        AND i_manage_outlet(outlet_id)
        AND member_has_membership_at_outlet(profile_id, outlet_id)
    );

CREATE POLICY "customer_own_questions_responses_select" ON questions_responses
    FOR SELECT TO authenticated
    USING (deleted_at IS NULL AND profile_id = auth.uid());

CREATE POLICY "customer_own_questions_responses_insert" ON questions_responses
    FOR INSERT TO authenticated
    WITH CHECK (deleted_at IS NULL AND profile_id = auth.uid());

CREATE POLICY "customer_own_questions_responses_update" ON questions_responses
    FOR UPDATE TO authenticated
    USING (deleted_at IS NULL AND profile_id = auth.uid())
    WITH CHECK (deleted_at IS NULL AND profile_id = auth.uid());

-- Seed platform defaults
INSERT INTO question_definitions (
    outlet_id, form_name, question_key, label, helper_text, input_type,
    options_json, is_required, display_order, editable_by_customer, validation_json
) VALUES
(NULL, 'basic_info', 'emergency_contact_name', 'Emergency contact name', 'Someone we can call during a session.', 'text', NULL, true, 10, true, NULL),
(NULL, 'basic_info', 'emergency_contact_phone', 'Emergency contact phone', NULL, 'text', NULL, true, 20, true, NULL),
(NULL, 'basic_info', 'fitness_goal', 'Primary fitness goal', NULL, 'select',
 jsonb_build_array(
   jsonb_build_object('value', 'weight_loss', 'label', 'Weight loss'),
   jsonb_build_object('value', 'muscle_gain', 'label', 'Muscle gain'),
   jsonb_build_object('value', 'general_fitness', 'label', 'General fitness')
 ), true, 30, true, NULL),
(NULL, 'basic_info', 'activity_level', 'Typical activity level', NULL, 'select',
 jsonb_build_array(
   jsonb_build_object('value', 'sedentary', 'label', 'Sedentary'),
   jsonb_build_object('value', 'light', 'label', 'Lightly active'),
   jsonb_build_object('value', 'moderate', 'label', 'Moderately active'),
   jsonb_build_object('value', 'very_active', 'label', 'Very active')
 ), false, 40, true, NULL),

(NULL, 'health_screening', 'parq_acknowledged', 'I have read and answered the PAR-Q honestly', NULL, 'boolean', NULL, true, 10, false, NULL),
(NULL, 'health_screening', 'heart_condition', 'Has your doctor ever said you have a heart condition?', NULL, 'boolean', NULL, true, 20, false, NULL),
(NULL, 'health_screening', 'chest_pain_when_active', 'Do you feel chest pain when physically active?', NULL, 'boolean', NULL, true, 30, false, NULL),
(NULL, 'health_screening', 'medications_notes', 'Medications or conditions we should know about', NULL, 'text', NULL, false, 40, true, NULL),

(NULL, 'diet_preferences', 'diet_pattern', 'Diet pattern', NULL, 'multiselect',
 jsonb_build_array(
   jsonb_build_object('value', 'vegetarian', 'label', 'Vegetarian'),
   jsonb_build_object('value', 'vegan', 'label', 'Vegan'),
   jsonb_build_object('value', 'high_protein', 'label', 'High protein'),
   jsonb_build_object('value', 'no_restrictions', 'label', 'No restrictions')
 ), false, 10, true, NULL),
(NULL, 'diet_preferences', 'food_allergies', 'Food allergies', NULL, 'multiselect',
 jsonb_build_array(
   jsonb_build_object('value', 'dairy', 'label', 'Dairy'),
   jsonb_build_object('value', 'peanuts', 'label', 'Peanuts'),
   jsonb_build_object('value', 'shellfish', 'label', 'Shellfish'),
   jsonb_build_object('value', 'gluten', 'label', 'Gluten')
 ), false, 20, true, NULL),
(NULL, 'diet_preferences', 'hydration_liters', 'Approx. daily water intake (liters)', NULL, 'number', NULL, false, 30, true, '{"min": 0, "max": 8, "step": 0.1}'::jsonb),
(NULL, 'diet_preferences', 'sweet_tooth_scale', 'Sweet cravings (1 = low, 10 = high)', NULL, 'scale', NULL, false, 40, true, '{"min": 1, "max": 10, "step": 1}'::jsonb);
