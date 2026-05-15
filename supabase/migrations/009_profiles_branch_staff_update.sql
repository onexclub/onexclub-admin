-- Allow gym owners/admins/front desk staff to revise member-visible profile facts for rostered outlets.
CREATE POLICY "branch_front_updates_customer_profiles"
    ON profiles FOR UPDATE TO authenticated
    USING (
        deleted_at IS NULL
        AND i_can_see_member(id)
        AND EXISTS (
            SELECT 1
            FROM staff_assignments sa
            JOIN gym_memberships gm
              ON gm.outlet_id = sa.outlet_id
             AND gm.profile_id = profiles.id
             AND gm.deleted_at IS NULL
            WHERE sa.profile_id = auth.uid()
              AND sa.revoked_at IS NULL
              AND sa.role IN ('gym_owner','branch_admin','receptionist')
        )
    )
    WITH CHECK (
        deleted_at IS NULL
        AND is_superadmin IS FALSE
    );
