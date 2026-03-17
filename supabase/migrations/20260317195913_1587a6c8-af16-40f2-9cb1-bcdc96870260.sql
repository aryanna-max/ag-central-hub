
-- Drop the unique constraint that prevents multiple entries per team+obra+month
ALTER TABLE monthly_schedules DROP CONSTRAINT monthly_schedules_team_id_obra_id_month_year_key;

-- Clear existing monthly schedules for Jan-Mar 2026
DELETE FROM monthly_schedules WHERE year = 2026 AND month IN (1, 2, 3);

-- Insert aggregated monthly schedules from daily assignments
-- One entry per team+obra+month with full date range
WITH daily_data AS (
  SELECT 
    dta.team_id,
    dta.obra_id,
    dta.vehicle_id,
    ds.schedule_date,
    EXTRACT(MONTH FROM ds.schedule_date)::int AS month,
    EXTRACT(YEAR FROM ds.schedule_date)::int AS year
  FROM daily_team_assignments dta
  JOIN daily_schedules ds ON ds.id = dta.daily_schedule_id
  WHERE ds.schedule_date >= '2026-01-01' AND ds.schedule_date <= '2026-03-31'
    AND dta.obra_id IS NOT NULL
),
ranges AS (
  SELECT 
    team_id, obra_id, month, year,
    MIN(schedule_date) AS start_date,
    MAX(schedule_date) AS end_date,
    MODE() WITHIN GROUP (ORDER BY vehicle_id) AS vehicle_id
  FROM daily_data
  GROUP BY team_id, obra_id, month, year
)
INSERT INTO monthly_schedules (team_id, obra_id, vehicle_id, month, year, start_date, end_date, schedule_type)
SELECT team_id, obra_id, vehicle_id, month, year, start_date, end_date, 'mensal'
FROM ranges
ORDER BY year, month, start_date;
