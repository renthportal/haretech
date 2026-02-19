-- ============================================
-- WindLift - Seed Data
-- Türbin Modelleri + Örnek Vinçler
-- ============================================

-- Türbin Modelleri
INSERT INTO turbine_models (manufacturer, model, rated_power_mw, rotor_diameter, nacelle_weight, hub_weight, blade_weight, blade_count, tower_sections, max_wind_nacelle, max_wind_blade, max_wind_tower) VALUES

('Vestas', 'V150-4.2', 4.2, 150, 69, 22, 24, 3,
  '[{"name":"TS1","weight":65,"height":25,"diameter_bottom":4.5,"diameter_top":4.0},{"name":"TS2","weight":65,"height":25,"diameter_bottom":4.0,"diameter_top":3.5},{"name":"TS3","weight":65,"height":25,"diameter_bottom":3.5,"diameter_top":3.0}]'::jsonb,
  10, 8, 12),

('Vestas', 'V162-6.2', 6.2, 162, 95, 28, 32, 3,
  '[{"name":"TS1","weight":70,"height":25,"diameter_bottom":5.0,"diameter_top":4.5},{"name":"TS2","weight":70,"height":25,"diameter_bottom":4.5,"diameter_top":4.0},{"name":"TS3","weight":70,"height":25,"diameter_bottom":4.0,"diameter_top":3.5},{"name":"TS4","weight":70,"height":25,"diameter_bottom":3.5,"diameter_top":3.0}]'::jsonb,
  10, 8, 12),

('Enercon', 'E-138 EP3', 4.2, 138, 72, 20, 18, 3,
  '[{"name":"TS1","weight":55,"height":25,"diameter_bottom":4.3,"diameter_top":3.8},{"name":"TS2","weight":55,"height":25,"diameter_bottom":3.8,"diameter_top":3.3},{"name":"TS3","weight":55,"height":25,"diameter_bottom":3.3,"diameter_top":2.8}]'::jsonb,
  10, 8, 12),

('Siemens Gamesa', 'SG 5.0-145', 5.0, 145, 82, 25, 26, 3,
  '[{"name":"TS1","weight":62,"height":25,"diameter_bottom":4.6,"diameter_top":4.1},{"name":"TS2","weight":62,"height":25,"diameter_bottom":4.1,"diameter_top":3.6},{"name":"TS3","weight":62,"height":25,"diameter_bottom":3.6,"diameter_top":3.1}]'::jsonb,
  10, 8, 12),

('Nordex', 'N163/5.X', 5.0, 163, 88, 24, 30, 3,
  '[{"name":"TS1","weight":58,"height":25,"diameter_bottom":5.0,"diameter_top":4.5},{"name":"TS2","weight":58,"height":25,"diameter_bottom":4.5,"diameter_top":4.0},{"name":"TS3","weight":58,"height":25,"diameter_bottom":4.0,"diameter_top":3.5},{"name":"TS4","weight":58,"height":25,"diameter_bottom":3.5,"diameter_top":3.0}]'::jsonb,
  10, 8, 12),

('GE', 'GE 3.8-137', 3.8, 137, 65, 19, 20, 3,
  '[{"name":"TS1","weight":50,"height":25,"diameter_bottom":4.2,"diameter_top":3.7},{"name":"TS2","weight":50,"height":25,"diameter_bottom":3.7,"diameter_top":3.2},{"name":"TS3","weight":50,"height":25,"diameter_bottom":3.2,"diameter_top":2.7}]'::jsonb,
  10, 8, 12);
