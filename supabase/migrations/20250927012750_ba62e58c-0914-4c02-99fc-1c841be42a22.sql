-- Update RLS policies for activity logs to implement hierarchical access control

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and managers can view activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Regional and District managers can view activity logs" ON activity_logs;

-- Create new hierarchical policies for viewing activity logs
CREATE POLICY "Admins can view all activity logs"
ON activity_logs FOR SELECT
USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Regional managers can view logs from their hierarchy"
ON activity_logs FOR SELECT
USING (
  get_user_role(auth.uid()) = 'regional_manager' AND
  user_id IN (
    SELECT p.id FROM profiles p 
    WHERE p.role IN ('district_manager', 'manager', 'assistant_manager', 'staff')
    AND (p.region_id = (SELECT region_id FROM profiles WHERE user_id = auth.uid())
         OR p.branch_id IN (
           SELECT b.id FROM branches b 
           WHERE b.region_id = (SELECT region_id FROM profiles WHERE user_id = auth.uid())
         ))
  )
);

CREATE POLICY "District managers can view logs from their hierarchy"
ON activity_logs FOR SELECT
USING (
  get_user_role(auth.uid()) = 'district_manager' AND
  user_id IN (
    SELECT p.id FROM profiles p 
    WHERE p.role IN ('manager', 'assistant_manager', 'staff')
    AND (p.district_id = (SELECT district_id FROM profiles WHERE user_id = auth.uid())
         OR p.branch_id IN (
           SELECT b.id FROM branches b 
           WHERE b.district_id = (SELECT district_id FROM profiles WHERE user_id = auth.uid())
         ))
  )
);

CREATE POLICY "Managers can view logs from their hierarchy"
ON activity_logs FOR SELECT
USING (
  get_user_role(auth.uid()) = 'manager' AND
  user_id IN (
    SELECT p.id FROM profiles p 
    WHERE p.role IN ('assistant_manager', 'staff')
    AND p.branch_id = get_user_branch(auth.uid())
  )
);

CREATE POLICY "Assistant managers can view staff logs"
ON activity_logs FOR SELECT
USING (
  get_user_role(auth.uid()) = 'assistant_manager' AND
  user_id IN (
    SELECT p.id FROM profiles p 
    WHERE p.role = 'staff'
    AND p.branch_id = get_user_branch(auth.uid())
  )
);

CREATE POLICY "Users can view their own activity logs"
ON activity_logs FOR SELECT
USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));