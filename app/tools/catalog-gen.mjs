/* Generator für Migration 0047 · Übungskatalog als Basisbewegung × Variante.
   node catalog-gen.mjs > 0047_exercise_catalog_variants.sql */
const M = {
  bench_press:       { name: 'Bankdrücken', pattern: 'horizontal_push', mus: { chest: [1, 'direct'], triceps: [0.5, 'indirect'], front_delts: [0.4, 'indirect'] } },
  incline_press:     { name: 'Schrägbankdrücken', pattern: 'horizontal_push', mus: { chest: [1, 'direct'], front_delts: [0.5, 'indirect'], triceps: [0.4, 'indirect'] } },
  decline_press:     { name: 'Negativbankdrücken', pattern: 'horizontal_push', mus: { chest: [1, 'direct'], triceps: [0.5, 'indirect'], front_delts: [0.3, 'indirect'] } },
  chest_press:       { name: 'Brustpresse', pattern: 'horizontal_push', mus: { chest: [1, 'direct'], triceps: [0.4, 'indirect'], front_delts: [0.3, 'indirect'] } },
  chest_fly:         { name: 'Flys / Butterfly', pattern: 'horizontal_push', mus: { chest: [1, 'direct'], front_delts: [0.25, 'indirect'] } },
  pushup:            { name: 'Liegestütze', pattern: 'horizontal_push', mus: { chest: [1, 'direct'], triceps: [0.5, 'indirect'], front_delts: [0.4, 'indirect'] } },
  dip:               { name: 'Dips', pattern: 'horizontal_push', mus: { chest: [1, 'direct'], triceps: [0.6, 'indirect'], front_delts: [0.3, 'indirect'] } },
  overhead_press:    { name: 'Schulterdrücken', pattern: 'vertical_push', mus: { front_delts: [1, 'direct'], side_delts: [0.5, 'indirect'], triceps: [0.5, 'indirect'] } },
  lateral_raise:     { name: 'Seitheben', pattern: 'shoulder_abduction', mus: { side_delts: [1, 'direct'] } },
  front_raise:       { name: 'Frontheben', pattern: 'shoulder_flexion', mus: { front_delts: [1, 'direct'] } },
  rear_delt:         { name: 'Reverse Flys', pattern: 'horizontal_pull', mus: { rear_delts: [1, 'direct'], upper_back: [0.4, 'indirect'] } },
  face_pull:         { name: 'Face Pulls', pattern: 'horizontal_pull', mus: { rear_delts: [1, 'direct'], upper_back: [0.5, 'indirect'] } },
  upright_row:       { name: 'Aufrechtes Rudern', pattern: 'shoulder_abduction', mus: { side_delts: [1, 'direct'], traps: [0.5, 'indirect'], biceps: [0.3, 'indirect'] } },
  shrug:             { name: 'Shrugs', pattern: 'shoulder_elevation', mus: { traps: [1, 'direct'] } },
  pullup:            { name: 'Klimmzüge', pattern: 'vertical_pull', mus: { lats: [1, 'direct'], biceps: [0.5, 'indirect'], upper_back: [0.4, 'indirect'] } },
  lat_pulldown:      { name: 'Latzug', pattern: 'vertical_pull', mus: { lats: [1, 'direct'], biceps: [0.5, 'indirect'], upper_back: [0.4, 'indirect'] } },
  pullover:          { name: 'Überzüge / Straight-Arm', pattern: 'vertical_pull', mus: { lats: [1, 'direct'], chest: [0.3, 'indirect'], triceps: [0.2, 'indirect'] } },
  row:               { name: 'Rudern', pattern: 'horizontal_pull', mus: { upper_back: [1, 'direct'], lats: [0.6, 'indirect'], biceps: [0.5, 'indirect'], rear_delts: [0.4, 'indirect'] } },
  squat:             { name: 'Kniebeuge', pattern: 'squat', mus: { quads: [1, 'direct'], glutes: [0.6, 'indirect'], lower_back: [0.3, 'indirect'] } },
  leg_press:         { name: 'Beinpresse', pattern: 'squat', mus: { quads: [1, 'direct'], glutes: [0.5, 'indirect'] } },
  hack_squat:        { name: 'Hackenschmidt', pattern: 'squat', mus: { quads: [1, 'direct'], glutes: [0.4, 'indirect'] } },
  lunge:             { name: 'Ausfallschritte', pattern: 'lunge', mus: { quads: [1, 'direct'], glutes: [0.6, 'indirect'], hamstrings: [0.3, 'indirect'] } },
  split_squat:       { name: 'Split Squat', pattern: 'lunge', mus: { quads: [1, 'direct'], glutes: [0.6, 'indirect'] } },
  step_up:           { name: 'Step-ups', pattern: 'lunge', mus: { quads: [1, 'direct'], glutes: [0.6, 'indirect'] } },
  deadlift:          { name: 'Kreuzheben', pattern: 'hinge', mus: { glutes: [1, 'direct'], hamstrings: [1, 'direct'], lower_back: [1, 'direct'], upper_back: [0.5, 'indirect'], traps: [0.4, 'indirect'] } },
  rdl:               { name: 'Rumänisches Kreuzheben', pattern: 'hinge', mus: { hamstrings: [1, 'direct'], glutes: [0.6, 'indirect'], lower_back: [0.4, 'indirect'] } },
  good_morning:      { name: 'Good Mornings', pattern: 'hinge', mus: { hamstrings: [1, 'direct'], glutes: [0.5, 'indirect'], lower_back: [0.6, 'indirect'] } },
  hip_thrust:        { name: 'Hip Thrust', pattern: 'hip_extension', mus: { glutes: [1, 'direct'], hamstrings: [0.4, 'indirect'] } },
  back_extension:    { name: 'Rückenstrecker', pattern: 'trunk_extension', mus: { lower_back: [1, 'direct'], glutes: [0.6, 'indirect'], hamstrings: [0.5, 'indirect'] } },
  leg_curl:          { name: 'Beinbeuger', pattern: 'knee_flexion', mus: { hamstrings: [1, 'direct'] } },
  leg_extension:     { name: 'Beinstrecker', pattern: 'knee_extension', mus: { quads: [1, 'direct'] } },
  calf_raise:        { name: 'Wadenheben', pattern: 'calf', mus: { calves: [1, 'direct'] } },
  hip_adduction:     { name: 'Adduktoren', pattern: 'hip_adduction', mus: { adductors: [1, 'direct'] } },
  hip_abduction:     { name: 'Abduktoren', pattern: 'hip_abduction', mus: { abductors: [1, 'direct'], glutes: [0.5, 'indirect'] } },
  glute_kickback:    { name: 'Kickbacks', pattern: 'hip_extension', mus: { glutes: [1, 'direct'] } },
  biceps_curl:       { name: 'Bizepscurls', pattern: 'elbow_flexion', mus: { biceps: [1, 'direct'], forearms: [0.3, 'indirect'] } },
  hammer_curl:       { name: 'Hammercurls', pattern: 'elbow_flexion', mus: { biceps: [1, 'direct'], forearms: [0.6, 'indirect'] } },
  triceps_extension: { name: 'Trizeps', pattern: 'elbow_extension', mus: { triceps: [1, 'direct'] } },
  wrist:             { name: 'Unterarme', pattern: 'wrist_flexion', mus: { forearms: [1, 'direct'] } },
  crunch:            { name: 'Crunches', pattern: 'trunk_flexion', mus: { abs: [1, 'direct'] } },
  leg_raise:         { name: 'Beinheben', pattern: 'trunk_flexion', mus: { abs: [1, 'direct'], hip_flexors: [0.6, 'indirect'] } },
  plank:             { name: 'Plank', pattern: 'stability', mus: { abs: [1, 'direct'] } },
  anti_rotation:     { name: 'Anti-Rotation', pattern: 'anti_rotation', mus: { abs: [1, 'direct'] } },
  rotation:          { name: 'Rotation', pattern: 'rotation', mus: { abs: [1, 'direct'] } },
  carry:             { name: 'Carries', pattern: 'carry', mus: { forearms: [1, 'direct'], traps: [0.6, 'indirect'], abs: [0.5, 'indirect'] } },
  plyo:              { name: 'Sprünge', pattern: 'jump', mus: { quads: [1, 'direct'], glutes: [0.6, 'indirect'], calves: [0.5, 'indirect'] } }
};
/* Varianten: [slug, base, name, aliases, {equipment, grip, angle, execution}, equipmentKeys, difficulty, flags{uni,bw,cat,mus(override)}] */
const X = [
  /* Brust */
  ['bench_press', 'bench_press', 'Bankdrücken', ['barbell bench press', 'flachbank'], { equipment: 'barbell', angle: 'flat' }, ['barbell', 'bench', 'rack'], 'beginner'],
  ['db_bench_press', 'bench_press', 'Kurzhantel-Bankdrücken', ['dumbbell bench press'], { equipment: 'dumbbell', angle: 'flat' }, ['dumbbell', 'bench'], 'beginner'],
  ['smith_bench_press', 'bench_press', 'Bankdrücken Smith Machine', ['smith bench'], { equipment: 'smith', angle: 'flat' }, ['smith', 'bench'], 'beginner'],
  ['close_grip_bench', 'bench_press', 'Enges Bankdrücken', ['close grip bench'], { equipment: 'barbell', grip: 'close', angle: 'flat' }, ['barbell', 'bench', 'rack'], 'intermediate', { mus: { triceps: [1, 'direct'], chest: [0.6, 'indirect'], front_delts: [0.3, 'indirect'] } }],
  ['floor_press', 'bench_press', 'Floor Press', [], { equipment: 'barbell', angle: 'flat', execution: 'floor' }, ['barbell'], 'intermediate'],
  ['incline_bench_press', 'incline_press', 'Schrägbankdrücken', ['incline bench press'], { equipment: 'barbell', angle: 'incline' }, ['barbell', 'bench', 'rack'], 'beginner'],
  ['db_incline_press', 'incline_press', 'Kurzhantel-Schrägbankdrücken', ['incline dumbbell press'], { equipment: 'dumbbell', angle: 'incline' }, ['dumbbell', 'bench'], 'beginner'],
  ['smith_incline_press', 'incline_press', 'Schrägbankdrücken Smith Machine', [], { equipment: 'smith', angle: 'incline' }, ['smith', 'bench'], 'beginner'],
  ['incline_press_machine', 'incline_press', 'Schrägbankpresse Maschine', ['incline press machine'], { equipment: 'machine', angle: 'incline' }, ['machine'], 'beginner'],
  ['decline_bench_press', 'decline_press', 'Negativbankdrücken', ['decline bench press'], { equipment: 'barbell', angle: 'decline' }, ['barbell', 'bench'], 'intermediate'],
  ['db_decline_press', 'decline_press', 'Kurzhantel-Negativbankdrücken', [], { equipment: 'dumbbell', angle: 'decline' }, ['dumbbell', 'bench'], 'intermediate'],
  ['chest_press_machine', 'chest_press', 'Brustpresse Maschine', ['chest press machine'], { equipment: 'machine', angle: 'flat' }, ['machine'], 'beginner'],
  ['chest_press_machine_incline', 'chest_press', 'Brustpresse Maschine schräg', [], { equipment: 'machine', angle: 'incline' }, ['machine'], 'beginner'],
  ['cable_chest_press', 'chest_press', 'Brustpresse Kabel', ['cable press'], { equipment: 'cable', angle: 'flat' }, ['cable'], 'beginner'],
  ['cable_chest_press_single', 'chest_press', 'Brustpresse Kabel einarmig', [], { equipment: 'cable', execution: 'single_arm' }, ['cable'], 'intermediate', { uni: true }],
  ['pec_deck', 'chest_fly', 'Butterfly / Pec Deck', ['butterfly', 'pec deck', 'fly machine'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['cable_fly', 'chest_fly', 'Kabel-Flys', ['cable fly', 'cable crossover'], { equipment: 'cable', angle: 'mid' }, ['cable'], 'beginner'],
  ['cable_fly_high', 'chest_fly', 'Kabel-Flys von oben', ['high to low fly', 'cable crossover high'], { equipment: 'cable', angle: 'high_to_low' }, ['cable'], 'beginner'],
  ['cable_fly_low', 'chest_fly', 'Kabel-Flys von unten', ['low to high fly'], { equipment: 'cable', angle: 'low_to_high' }, ['cable'], 'beginner', { mus: { chest: [1, 'direct'], front_delts: [0.4, 'indirect'] } }],
  ['db_fly', 'chest_fly', 'Kurzhantel-Flys', ['dumbbell fly', 'fliegende'], { equipment: 'dumbbell', angle: 'flat' }, ['dumbbell', 'bench'], 'beginner'],
  ['db_incline_fly', 'chest_fly', 'Kurzhantel-Flys Schrägbank', ['incline dumbbell fly'], { equipment: 'dumbbell', angle: 'incline' }, ['dumbbell', 'bench'], 'beginner'],
  ['pushup', 'pushup', 'Liegestütze', ['push-up', 'push up'], { equipment: 'bodyweight' }, ['bodyweight'], 'beginner', { bw: true }],
  ['pushup_incline', 'pushup', 'Liegestütze erhöht', ['incline pushup'], { equipment: 'bodyweight', angle: 'incline' }, ['bodyweight', 'bench'], 'beginner', { bw: true }],
  ['pushup_decline', 'pushup', 'Liegestütze Füße erhöht', ['decline pushup'], { equipment: 'bodyweight', angle: 'decline' }, ['bodyweight', 'bench'], 'intermediate', { bw: true }],
  ['pushup_weighted', 'pushup', 'Liegestütze mit Zusatzlast', ['weighted pushup'], { equipment: 'bodyweight', execution: 'weighted' }, ['bodyweight', 'plate'], 'intermediate', { bw: true }],
  ['chest_dip', 'dip', 'Dips (brustbetont)', ['chest dips'], { equipment: 'bodyweight', execution: 'lean_forward' }, ['dip_bars'], 'intermediate', { bw: true }],
  ['triceps_dip', 'dip', 'Dips (trizepsbetont)', ['triceps dips'], { equipment: 'bodyweight', execution: 'upright' }, ['dip_bars'], 'intermediate', { bw: true, mus: { triceps: [1, 'direct'], chest: [0.5, 'indirect'], front_delts: [0.3, 'indirect'] } }],
  ['dip_machine', 'dip', 'Dip-Maschine', ['assisted dip', 'seated dip machine'], { equipment: 'machine' }, ['machine'], 'beginner', { mus: { triceps: [1, 'direct'], chest: [0.6, 'indirect'] } }],
  ['bench_dip', 'dip', 'Bank-Dips', ['bench dips'], { equipment: 'bodyweight', execution: 'bench' }, ['bench'], 'beginner', { bw: true, mus: { triceps: [1, 'direct'], chest: [0.3, 'indirect'] } }],
  /* Schulter */
  ['overhead_press', 'overhead_press', 'Schulterdrücken Langhantel', ['overhead press', 'ohp', 'military press'], { equipment: 'barbell', execution: 'standing' }, ['barbell', 'rack'], 'intermediate'],
  ['seated_barbell_press', 'overhead_press', 'Schulterdrücken Langhantel sitzend', ['seated ohp'], { equipment: 'barbell', execution: 'seated' }, ['barbell', 'bench', 'rack'], 'intermediate'],
  ['db_shoulder_press', 'overhead_press', 'Schulterdrücken Kurzhantel', ['dumbbell shoulder press'], { equipment: 'dumbbell', execution: 'seated' }, ['dumbbell', 'bench'], 'beginner'],
  ['arnold_press', 'overhead_press', 'Arnold Press', [], { equipment: 'dumbbell', execution: 'rotating' }, ['dumbbell', 'bench'], 'intermediate'],
  ['smith_shoulder_press', 'overhead_press', 'Schulterdrücken Smith Machine', [], { equipment: 'smith', execution: 'seated' }, ['smith', 'bench'], 'beginner'],
  ['shoulder_press_machine', 'overhead_press', 'Schulterpresse Maschine', ['shoulder press machine'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['landmine_press', 'overhead_press', 'Landmine Press', [], { equipment: 'barbell', execution: 'landmine' }, ['barbell'], 'intermediate', { uni: true }],
  ['push_press', 'overhead_press', 'Push Press', [], { equipment: 'barbell', execution: 'push' }, ['barbell', 'rack'], 'advanced'],
  ['lateral_raise', 'lateral_raise', 'Seitheben Kurzhantel', ['lateral raise', 'side raise'], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner'],
  ['cable_lateral_raise', 'lateral_raise', 'Seitheben Kabel', ['cable lateral raise'], { equipment: 'cable', execution: 'single_arm' }, ['cable'], 'beginner', { uni: true }],
  ['machine_lateral_raise', 'lateral_raise', 'Seitheben Maschine', ['lateral raise machine'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['lean_away_lateral_raise', 'lateral_raise', 'Seitheben angelehnt', ['leaning lateral raise'], { equipment: 'dumbbell', execution: 'leaning' }, ['dumbbell', 'rack'], 'intermediate', { uni: true }],
  ['front_raise', 'front_raise', 'Frontheben Kurzhantel', ['front raise'], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner'],
  ['cable_front_raise', 'front_raise', 'Frontheben Kabel', [], { equipment: 'cable' }, ['cable'], 'beginner'],
  ['plate_front_raise', 'front_raise', 'Frontheben Scheibe', [], { equipment: 'plate' }, ['plate'], 'beginner'],
  ['reverse_fly', 'rear_delt', 'Reverse Flys Kurzhantel', ['rear delt fly', 'bent over fly'], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner'],
  ['reverse_pec_deck', 'rear_delt', 'Reverse Pec Deck', ['reverse butterfly', 'rear delt machine'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['rear_delt_cable', 'rear_delt', 'Rear-Delt Kabelzug', ['cable rear delt fly'], { equipment: 'cable' }, ['cable'], 'beginner'],
  ['chest_supported_reverse_fly', 'rear_delt', 'Reverse Flys brustgestützt', [], { equipment: 'dumbbell', execution: 'chest_supported' }, ['dumbbell', 'bench'], 'beginner'],
  ['face_pull', 'face_pull', 'Face Pulls', ['face pull'], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['band_face_pull', 'face_pull', 'Face Pulls Band', [], { equipment: 'band' }, ['band'], 'beginner'],
  ['upright_row', 'upright_row', 'Aufrechtes Rudern Langhantel', ['upright row'], { equipment: 'barbell', grip: 'wide' }, ['barbell'], 'intermediate'],
  ['cable_upright_row', 'upright_row', 'Aufrechtes Rudern Kabel', [], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['barbell_shrug', 'shrug', 'Shrugs Langhantel', ['shrugs'], { equipment: 'barbell' }, ['barbell'], 'beginner'],
  ['db_shrug', 'shrug', 'Shrugs Kurzhantel', [], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner'],
  ['smith_shrug', 'shrug', 'Shrugs Smith Machine', [], { equipment: 'smith' }, ['smith'], 'beginner'],
  ['trap_bar_shrug', 'shrug', 'Shrugs Trap Bar', [], { equipment: 'trap_bar' }, ['trap_bar'], 'beginner'],
  /* Rücken vertikal */
  ['pullup', 'pullup', 'Klimmzüge', ['pull-up', 'pull up', 'klimmzug'], { equipment: 'bodyweight', grip: 'overhand_medium' }, ['pullup_bar'], 'intermediate', { bw: true }],
  ['pullup_wide', 'pullup', 'Klimmzüge breit', ['wide grip pull-up', 'breiter klimmzug'], { equipment: 'bodyweight', grip: 'overhand_wide' }, ['pullup_bar'], 'intermediate', { bw: true }],
  ['pullup_neutral', 'pullup', 'Klimmzüge neutral', ['neutral grip pull-up', 'hammer grip pullup'], { equipment: 'bodyweight', grip: 'neutral' }, ['pullup_bar'], 'intermediate', { bw: true }],
  ['chinup', 'pullup', 'Chin-ups', ['chin up', 'klimmzüge untergriff'], { equipment: 'bodyweight', grip: 'underhand' }, ['pullup_bar'], 'intermediate', { bw: true, mus: { lats: [1, 'direct'], biceps: [0.7, 'indirect'], upper_back: [0.4, 'indirect'] } }],
  ['pullup_weighted', 'pullup', 'Klimmzüge mit Zusatzlast', ['weighted pull-up'], { equipment: 'bodyweight', execution: 'weighted' }, ['pullup_bar', 'plate'], 'advanced', { bw: true }],
  ['pullup_assisted', 'pullup', 'Klimmzüge assistiert', ['assisted pull-up', 'klimmzugmaschine'], { equipment: 'machine', execution: 'assisted' }, ['machine'], 'beginner'],
  ['pullup_band', 'pullup', 'Klimmzüge mit Band', ['band assisted pull-up'], { equipment: 'band', execution: 'assisted' }, ['pullup_bar', 'band'], 'beginner', { bw: true }],
  ['lat_pulldown', 'lat_pulldown', 'Latzug breit', ['lat pulldown', 'latziehen'], { equipment: 'cable', grip: 'overhand_wide' }, ['cable'], 'beginner'],
  ['lat_pulldown_close', 'lat_pulldown', 'Latzug eng', ['close grip pulldown'], { equipment: 'cable', grip: 'overhand_close' }, ['cable'], 'beginner'],
  ['lat_pulldown_neutral', 'lat_pulldown', 'Latzug neutral (V-Griff)', ['neutral grip pulldown', 'v-bar pulldown'], { equipment: 'cable', grip: 'neutral' }, ['cable'], 'beginner'],
  ['lat_pulldown_underhand', 'lat_pulldown', 'Latzug Untergriff', ['underhand pulldown', 'reverse grip pulldown'], { equipment: 'cable', grip: 'underhand' }, ['cable'], 'beginner', { mus: { lats: [1, 'direct'], biceps: [0.7, 'indirect'], upper_back: [0.4, 'indirect'] } }],
  ['lat_pulldown_single', 'lat_pulldown', 'Latzug einarmig', ['single arm pulldown'], { equipment: 'cable', execution: 'single_arm' }, ['cable'], 'intermediate', { uni: true }],
  ['lat_pulldown_machine', 'lat_pulldown', 'Latzug Maschine', ['lat pulldown machine', 'plate loaded pulldown'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['straight_arm_pulldown', 'pullover', 'Straight-Arm Pulldown', ['straight arm pulldown', 'lat pushdown'], { equipment: 'cable', grip: 'bar' }, ['cable'], 'beginner'],
  ['rope_pullover', 'pullover', 'Kabel-Überzüge Seil', ['rope pullover'], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['db_pullover', 'pullover', 'Kurzhantel-Überzüge', ['dumbbell pullover'], { equipment: 'dumbbell' }, ['dumbbell', 'bench'], 'intermediate'],
  ['pullover_machine', 'pullover', 'Pullover Maschine', [], { equipment: 'machine' }, ['machine'], 'beginner'],
  /* Rücken horizontal */
  ['row', 'row', 'Rudern (allgemein)', ['rudern'], { equipment: 'barbell' }, ['barbell'], 'beginner'],
  ['barbell_row', 'row', 'Langhantelrudern', ['barbell row', 'bent over row'], { equipment: 'barbell', grip: 'overhand' }, ['barbell'], 'intermediate'],
  ['barbell_row_underhand', 'row', 'Langhantelrudern Untergriff', ['yates row', 'underhand row'], { equipment: 'barbell', grip: 'underhand' }, ['barbell'], 'intermediate'],
  ['pendlay_row', 'row', 'Pendlay Row', [], { equipment: 'barbell', execution: 'from_floor' }, ['barbell'], 'advanced'],
  ['db_row', 'row', 'Kurzhantelrudern einarmig', ['dumbbell row', 'one arm row'], { equipment: 'dumbbell', execution: 'single_arm' }, ['dumbbell', 'bench'], 'beginner', { uni: true }],
  ['db_row_both', 'row', 'Kurzhantelrudern beidseitig', [], { equipment: 'dumbbell', execution: 'bilateral' }, ['dumbbell'], 'beginner'],
  ['chest_supported_row', 'row', 'Brustgestütztes Rudern Kurzhantel', ['chest supported row', 'incline row'], { equipment: 'dumbbell', execution: 'chest_supported' }, ['dumbbell', 'bench'], 'beginner'],
  ['seal_row', 'row', 'Seal Row', [], { equipment: 'barbell', execution: 'chest_supported' }, ['barbell', 'bench'], 'intermediate'],
  ['t_bar_row', 'row', 'T-Bar Rudern', ['t-bar row', 't bar row'], { equipment: 't_bar', grip: 'neutral' }, ['t_bar'], 'intermediate'],
  ['t_bar_row_supported', 'row', 'T-Bar Rudern brustgestützt', ['chest supported t-bar row'], { equipment: 't_bar', execution: 'chest_supported' }, ['t_bar'], 'beginner'],
  ['cable_row', 'row', 'Kabelrudern V-Griff', ['seated cable row', 'kabelrudern'], { equipment: 'cable', grip: 'neutral_close' }, ['cable'], 'beginner'],
  ['cable_row_wide', 'row', 'Kabelrudern breit', ['wide grip cable row'], { equipment: 'cable', grip: 'overhand_wide' }, ['cable'], 'beginner'],
  ['cable_row_rope', 'row', 'Kabelrudern Seil', [], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['cable_row_single', 'row', 'Kabelrudern einarmig', ['single arm cable row'], { equipment: 'cable', execution: 'single_arm' }, ['cable'], 'intermediate', { uni: true }],
  ['row_machine', 'row', 'Rudermaschine', ['row machine', 'seated row machine'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['row_machine_high', 'row', 'Rudermaschine hoch (High Row)', ['high row'], { equipment: 'machine', angle: 'high' }, ['machine'], 'beginner', { mus: { lats: [1, 'direct'], upper_back: [0.6, 'indirect'], biceps: [0.5, 'indirect'] } }],
  ['smith_row', 'row', 'Rudern Smith Machine', [], { equipment: 'smith' }, ['smith'], 'beginner'],
  ['inverted_row', 'row', 'Inverted Rows', ['australian pull-up', 'body row'], { equipment: 'bodyweight' }, ['smith', 'rack'], 'beginner', { bw: true }],
  ['meadows_row', 'row', 'Meadows Row', [], { equipment: 'barbell', execution: 'landmine' }, ['barbell'], 'advanced', { uni: true }],
  /* Beine – Kniebeuge */
  ['squat', 'squat', 'Kniebeuge Langhantel', ['back squat', 'squat', 'kniebeugen'], { equipment: 'barbell', execution: 'high_bar' }, ['barbell', 'rack'], 'intermediate'],
  ['low_bar_squat', 'squat', 'Kniebeuge Low Bar', ['low bar squat'], { equipment: 'barbell', execution: 'low_bar' }, ['barbell', 'rack'], 'intermediate', { mus: { quads: [1, 'direct'], glutes: [0.8, 'indirect'], lower_back: [0.4, 'indirect'], hamstrings: [0.3, 'indirect'] } }],
  ['front_squat', 'squat', 'Frontkniebeuge', ['front squat'], { equipment: 'barbell', execution: 'front' }, ['barbell', 'rack'], 'advanced', { mus: { quads: [1, 'direct'], glutes: [0.5, 'indirect'], abs: [0.3, 'indirect'] } }],
  ['smith_squat', 'squat', 'Kniebeuge Smith Machine', ['smith squat'], { equipment: 'smith' }, ['smith'], 'beginner'],
  ['goblet_squat', 'squat', 'Goblet Squat', ['goblet'], { equipment: 'dumbbell', execution: 'goblet' }, ['dumbbell', 'kettlebell'], 'beginner'],
  ['sumo_squat', 'squat', 'Sumo Squat', ['sumo kniebeuge'], { equipment: 'dumbbell', execution: 'sumo' }, ['dumbbell', 'kettlebell'], 'beginner', { mus: { quads: [1, 'direct'], glutes: [0.6, 'indirect'], adductors: [0.6, 'indirect'] } }],
  ['zercher_squat', 'squat', 'Zercher Squat', [], { equipment: 'barbell', execution: 'zercher' }, ['barbell', 'rack'], 'advanced'],
  ['safety_bar_squat', 'squat', 'Safety-Bar Squat', ['ssb squat'], { equipment: 'barbell', execution: 'safety_bar' }, ['barbell', 'rack'], 'intermediate'],
  ['box_squat', 'squat', 'Box Squat', [], { equipment: 'barbell', execution: 'box' }, ['barbell', 'rack', 'box'], 'intermediate'],
  ['belt_squat', 'squat', 'Belt Squat', [], { equipment: 'machine', execution: 'belt' }, ['machine'], 'intermediate'],
  ['pendulum_squat', 'squat', 'Pendulum Squat', [], { equipment: 'machine', execution: 'pendulum' }, ['machine'], 'beginner'],
  ['bodyweight_squat', 'squat', 'Kniebeuge Körpergewicht', ['air squat'], { equipment: 'bodyweight' }, ['bodyweight'], 'beginner', { bw: true }],
  ['leg_press', 'leg_press', 'Beinpresse 45°', ['leg press', 'beinpresse'], { equipment: 'leg_press', angle: '45' }, ['leg_press'], 'beginner'],
  ['leg_press_horizontal', 'leg_press', 'Beinpresse horizontal', ['seated leg press'], { equipment: 'machine', angle: 'horizontal' }, ['machine'], 'beginner'],
  ['leg_press_single', 'leg_press', 'Beinpresse einbeinig', ['single leg press'], { equipment: 'leg_press', execution: 'single_leg' }, ['leg_press'], 'intermediate', { uni: true }],
  ['leg_press_high_feet', 'leg_press', 'Beinpresse Füße hoch', [], { equipment: 'leg_press', execution: 'feet_high' }, ['leg_press'], 'beginner', { mus: { glutes: [1, 'direct'], hamstrings: [0.6, 'indirect'], quads: [0.6, 'indirect'] } }],
  ['hack_squat', 'hack_squat', 'Hackenschmidt-Kniebeuge', ['hack squat'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['reverse_hack_squat', 'hack_squat', 'Reverse Hack Squat', [], { equipment: 'machine', execution: 'reverse' }, ['machine'], 'intermediate', { mus: { glutes: [1, 'direct'], quads: [0.7, 'indirect'], hamstrings: [0.4, 'indirect'] } }],
  ['v_squat', 'hack_squat', 'V-Squat Maschine', ['v squat'], { equipment: 'machine', execution: 'v_squat' }, ['machine'], 'beginner'],
  ['sissy_squat', 'hack_squat', 'Sissy Squat', [], { equipment: 'bodyweight' }, ['bodyweight'], 'advanced', { bw: true, mus: { quads: [1, 'direct'] } }],
  /* Beine – einbeinig */
  ['walking_lunge', 'lunge', 'Ausfallschritte gehend', ['walking lunge'], { equipment: 'dumbbell', execution: 'walking' }, ['dumbbell'], 'beginner', { uni: true }],
  ['reverse_lunge', 'lunge', 'Ausfallschritte rückwärts', ['reverse lunge'], { equipment: 'dumbbell', execution: 'reverse' }, ['dumbbell'], 'beginner', { uni: true }],
  ['forward_lunge', 'lunge', 'Ausfallschritte vorwärts', ['forward lunge', 'ausfallschritt'], { equipment: 'dumbbell', execution: 'forward' }, ['dumbbell'], 'beginner', { uni: true }],
  ['barbell_lunge', 'lunge', 'Ausfallschritte Langhantel', ['barbell lunge'], { equipment: 'barbell' }, ['barbell', 'rack'], 'intermediate', { uni: true }],
  ['smith_lunge', 'lunge', 'Ausfallschritte Smith Machine', [], { equipment: 'smith' }, ['smith'], 'beginner', { uni: true }],
  ['lateral_lunge', 'lunge', 'Seitliche Ausfallschritte', ['lateral lunge', 'side lunge'], { equipment: 'dumbbell', execution: 'lateral' }, ['dumbbell'], 'beginner', { uni: true, mus: { quads: [1, 'direct'], adductors: [0.7, 'indirect'], glutes: [0.5, 'indirect'] } }],
  ['bulgarian_split_squat', 'split_squat', 'Bulgarian Split Squat', ['bulgarian', 'rear foot elevated split squat'], { equipment: 'dumbbell', execution: 'rear_foot_elevated' }, ['dumbbell', 'bench'], 'intermediate', { uni: true }],
  ['smith_split_squat', 'split_squat', 'Split Squat Smith Machine', [], { equipment: 'smith' }, ['smith', 'bench'], 'beginner', { uni: true }],
  ['split_squat', 'split_squat', 'Split Squat', [], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner', { uni: true }],
  ['step_up', 'step_up', 'Step-ups', ['step up'], { equipment: 'dumbbell' }, ['dumbbell', 'box'], 'beginner', { uni: true }],
  ['step_up_barbell', 'step_up', 'Step-ups Langhantel', [], { equipment: 'barbell' }, ['barbell', 'box'], 'intermediate', { uni: true }],
  /* Hinge */
  ['deadlift', 'deadlift', 'Kreuzheben konventionell', ['deadlift', 'kreuzheben'], { equipment: 'barbell', execution: 'conventional' }, ['barbell'], 'intermediate'],
  ['sumo_deadlift', 'deadlift', 'Kreuzheben Sumo', ['sumo deadlift'], { equipment: 'barbell', execution: 'sumo' }, ['barbell'], 'intermediate', { mus: { glutes: [1, 'direct'], quads: [0.7, 'indirect'], hamstrings: [0.6, 'indirect'], adductors: [0.6, 'indirect'], lower_back: [0.6, 'indirect'] } }],
  ['trap_bar_deadlift', 'deadlift', 'Kreuzheben Trap Bar', ['trap bar deadlift', 'hex bar deadlift'], { equipment: 'trap_bar' }, ['trap_bar'], 'beginner', { mus: { glutes: [1, 'direct'], quads: [0.8, 'indirect'], hamstrings: [0.6, 'indirect'], lower_back: [0.6, 'indirect'], traps: [0.4, 'indirect'] } }],
  ['deficit_deadlift', 'deadlift', 'Kreuzheben Defizit', [], { equipment: 'barbell', execution: 'deficit' }, ['barbell', 'plate'], 'advanced'],
  ['rack_pull', 'deadlift', 'Rack Pulls', ['rack pull'], { equipment: 'barbell', execution: 'partial' }, ['barbell', 'rack'], 'intermediate', { mus: { glutes: [1, 'direct'], lower_back: [1, 'direct'], upper_back: [0.6, 'indirect'], traps: [0.6, 'indirect'], hamstrings: [0.4, 'indirect'] } }],
  ['romanian_deadlift', 'rdl', 'Rumänisches Kreuzheben', ['rdl', 'romanian deadlift'], { equipment: 'barbell' }, ['barbell'], 'intermediate'],
  ['db_rdl', 'rdl', 'Rumänisches Kreuzheben Kurzhantel', ['dumbbell rdl'], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner'],
  ['single_leg_rdl', 'rdl', 'Einbeiniges RDL', ['single leg rdl', 'single leg deadlift'], { equipment: 'dumbbell', execution: 'single_leg' }, ['dumbbell', 'kettlebell'], 'intermediate', { uni: true }],
  ['stiff_leg_deadlift', 'rdl', 'Gestrecktes Kreuzheben', ['stiff leg deadlift', 'sldl'], { equipment: 'barbell', execution: 'stiff_leg' }, ['barbell'], 'intermediate'],
  ['smith_rdl', 'rdl', 'RDL Smith Machine', [], { equipment: 'smith' }, ['smith'], 'beginner'],
  ['good_morning', 'good_morning', 'Good Mornings', ['good morning'], { equipment: 'barbell' }, ['barbell', 'rack'], 'advanced'],
  ['hip_thrust', 'hip_thrust', 'Hip Thrust Langhantel', ['hip thrust', 'barbell hip thrust'], { equipment: 'barbell' }, ['barbell', 'bench'], 'beginner'],
  ['hip_thrust_machine', 'hip_thrust', 'Hip Thrust Maschine', ['glute drive'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['smith_hip_thrust', 'hip_thrust', 'Hip Thrust Smith Machine', [], { equipment: 'smith' }, ['smith', 'bench'], 'beginner'],
  ['single_leg_hip_thrust', 'hip_thrust', 'Hip Thrust einbeinig', [], { equipment: 'bodyweight', execution: 'single_leg' }, ['bench'], 'beginner', { uni: true, bw: true }],
  ['glute_bridge', 'hip_thrust', 'Glute Bridge', ['bridge'], { equipment: 'bodyweight', execution: 'floor' }, ['bodyweight'], 'beginner', { bw: true }],
  ['cable_pull_through', 'hip_thrust', 'Cable Pull-Through', ['pull through'], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner', { mus: { glutes: [1, 'direct'], hamstrings: [0.6, 'indirect'] } }],
  ['kettlebell_swing', 'hip_thrust', 'Kettlebell Swing', ['kb swing'], { equipment: 'kettlebell' }, ['kettlebell'], 'intermediate', { mus: { glutes: [1, 'direct'], hamstrings: [0.7, 'indirect'], lower_back: [0.4, 'indirect'] } }],
  ['back_extension', 'back_extension', 'Rückenstrecker 45°', ['hyperextension', 'back extension'], { equipment: 'bodyweight', angle: '45' }, ['bodyweight'], 'beginner', { bw: true }],
  ['back_extension_machine', 'back_extension', 'Rückenstrecker Maschine', [], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['reverse_hyper', 'back_extension', 'Reverse Hyperextension', ['reverse hyper'], { equipment: 'machine', execution: 'reverse' }, ['machine'], 'intermediate', { mus: { glutes: [1, 'direct'], hamstrings: [0.6, 'indirect'], lower_back: [0.5, 'indirect'] } }],
  ['seated_leg_curl', 'leg_curl', 'Beinbeuger sitzend', ['seated leg curl'], { equipment: 'machine', execution: 'seated' }, ['machine'], 'beginner'],
  ['lying_leg_curl', 'leg_curl', 'Beinbeuger liegend', ['lying leg curl'], { equipment: 'machine', execution: 'lying' }, ['machine'], 'beginner'],
  ['leg_curl', 'leg_curl', 'Beinbeuger', ['leg curl'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['standing_leg_curl', 'leg_curl', 'Beinbeuger stehend einbeinig', ['standing leg curl'], { equipment: 'machine', execution: 'standing' }, ['machine'], 'beginner', { uni: true }],
  ['nordic_curl', 'leg_curl', 'Nordic Hamstring Curls', ['nordics', 'nordic curl'], { equipment: 'bodyweight' }, ['bodyweight'], 'advanced', { bw: true }],
  ['slider_leg_curl', 'leg_curl', 'Beinbeuger Slider / Ball', ['slider curl', 'swiss ball curl'], { equipment: 'bodyweight' }, ['bodyweight'], 'intermediate', { bw: true }],
  ['leg_extension', 'leg_extension', 'Beinstrecker', ['leg extension'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['leg_extension_single', 'leg_extension', 'Beinstrecker einbeinig', [], { equipment: 'machine', execution: 'single_leg' }, ['machine'], 'beginner', { uni: true }],
  ['standing_calf_raise', 'calf_raise', 'Wadenheben stehend', ['standing calf raise'], { equipment: 'machine', execution: 'standing' }, ['machine'], 'beginner'],
  ['seated_calf_raise', 'calf_raise', 'Wadenheben sitzend', ['seated calf raise'], { equipment: 'machine', execution: 'seated' }, ['machine'], 'beginner'],
  ['calf_raise', 'calf_raise', 'Wadenheben', ['calf raise'], { equipment: 'bodyweight' }, ['bodyweight'], 'beginner', { bw: true }],
  ['leg_press_calf_raise', 'calf_raise', 'Wadenheben Beinpresse', ['calf press'], { equipment: 'leg_press' }, ['leg_press'], 'beginner'],
  ['smith_calf_raise', 'calf_raise', 'Wadenheben Smith Machine', [], { equipment: 'smith' }, ['smith'], 'beginner'],
  ['single_leg_calf_raise', 'calf_raise', 'Wadenheben einbeinig', [], { equipment: 'dumbbell', execution: 'single_leg' }, ['dumbbell'], 'beginner', { uni: true }],
  ['adductor_machine', 'hip_adduction', 'Adduktorenmaschine', ['adductor machine', 'hip adduction'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['cable_adduction', 'hip_adduction', 'Adduktion Kabel', [], { equipment: 'cable' }, ['cable'], 'beginner', { uni: true }],
  ['copenhagen_plank', 'hip_adduction', 'Copenhagen Plank', ['copenhagen'], { equipment: 'bodyweight' }, ['bench'], 'intermediate', { bw: true, uni: true, mus: { adductors: [1, 'direct'], abs: [0.5, 'indirect'] } }],
  ['abductor_machine', 'hip_abduction', 'Abduktorenmaschine', ['abductor machine', 'hip abduction'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['cable_abduction', 'hip_abduction', 'Abduktion Kabel', [], { equipment: 'cable' }, ['cable'], 'beginner', { uni: true }],
  ['band_abduction', 'hip_abduction', 'Abduktion Band (Clamshell / Monster Walk)', ['clamshell', 'monster walk'], { equipment: 'band' }, ['band'], 'beginner'],
  ['cable_kickback', 'glute_kickback', 'Kickbacks Kabel', ['cable kickback', 'glute kickback'], { equipment: 'cable' }, ['cable'], 'beginner', { uni: true }],
  ['glute_kickback_machine', 'glute_kickback', 'Kickback Maschine', [], { equipment: 'machine' }, ['machine'], 'beginner', { uni: true }],
  /* Arme – Bizeps */
  ['biceps_curl', 'biceps_curl', 'Bizepscurls Kurzhantel', ['dumbbell curl', 'bizeps curls'], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner'],
  ['db_curl', 'biceps_curl', 'Kurzhantelcurls wechselnd', ['alternating dumbbell curl'], { equipment: 'dumbbell', execution: 'alternating' }, ['dumbbell'], 'beginner'],
  ['barbell_curl', 'biceps_curl', 'Langhantelcurls', ['barbell curl'], { equipment: 'barbell' }, ['barbell'], 'beginner'],
  ['ez_bar_curl', 'biceps_curl', 'SZ-Curls', ['ez bar curl', 'sz curls'], { equipment: 'ez_bar' }, ['ez_bar'], 'beginner'],
  ['incline_curl', 'biceps_curl', 'Schrägbankcurls', ['incline curl'], { equipment: 'dumbbell', angle: 'incline' }, ['dumbbell', 'bench'], 'beginner'],
  ['cable_curl', 'biceps_curl', 'Kabelcurls Stange', ['cable curl'], { equipment: 'cable', grip: 'bar' }, ['cable'], 'beginner'],
  ['cable_curl_rope', 'biceps_curl', 'Kabelcurls Seil', [], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['bayesian_curl', 'biceps_curl', 'Bayesian Curl (Kabel hinter dem Körper)', ['bayesian curl'], { equipment: 'cable', execution: 'behind_body' }, ['cable'], 'intermediate', { uni: true }],
  ['preacher_curl', 'biceps_curl', 'Preacher Curls', ['preacher curl', 'scott curls'], { equipment: 'ez_bar', execution: 'preacher' }, ['ez_bar', 'bench'], 'beginner'],
  ['preacher_curl_machine', 'biceps_curl', 'Bizepsmaschine', ['biceps machine', 'machine curl'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['spider_curl', 'biceps_curl', 'Spider Curls', [], { equipment: 'dumbbell', execution: 'spider' }, ['dumbbell', 'bench'], 'intermediate'],
  ['concentration_curl', 'biceps_curl', 'Konzentrationscurls', ['concentration curl'], { equipment: 'dumbbell', execution: 'concentration' }, ['dumbbell'], 'beginner', { uni: true }],
  ['drag_curl', 'biceps_curl', 'Drag Curls', [], { equipment: 'barbell', execution: 'drag' }, ['barbell'], 'intermediate'],
  ['hammer_curl', 'hammer_curl', 'Hammercurls', ['hammer curl'], { equipment: 'dumbbell' }, ['dumbbell'], 'beginner'],
  ['cable_hammer_curl', 'hammer_curl', 'Hammercurls Seil', ['rope hammer curl'], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['reverse_curl', 'hammer_curl', 'Reverse Curls', ['reverse curl'], { equipment: 'ez_bar', grip: 'overhand' }, ['ez_bar'], 'beginner', { mus: { forearms: [1, 'direct'], biceps: [0.5, 'indirect'] } }],
  ['cross_body_hammer_curl', 'hammer_curl', 'Hammercurls über Kreuz', ['cross body curl'], { equipment: 'dumbbell', execution: 'cross_body' }, ['dumbbell'], 'beginner'],
  /* Arme – Trizeps */
  ['triceps_pushdown', 'triceps_extension', 'Trizepsdrücken Stange', ['triceps pushdown', 'pushdown'], { equipment: 'cable', grip: 'bar' }, ['cable'], 'beginner'],
  ['rope_pushdown', 'triceps_extension', 'Trizepsdrücken Seil', ['rope pushdown'], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['v_bar_pushdown', 'triceps_extension', 'Trizepsdrücken V-Griff', ['v-bar pushdown'], { equipment: 'cable', grip: 'v_bar' }, ['cable'], 'beginner'],
  ['single_arm_pushdown', 'triceps_extension', 'Trizepsdrücken einarmig', [], { equipment: 'cable', execution: 'single_arm' }, ['cable'], 'beginner', { uni: true }],
  ['reverse_grip_pushdown', 'triceps_extension', 'Trizepsdrücken Untergriff', [], { equipment: 'cable', grip: 'underhand' }, ['cable'], 'beginner'],
  ['overhead_triceps', 'triceps_extension', 'Überkopf-Trizeps Kabel', ['overhead cable extension'], { equipment: 'cable', execution: 'overhead' }, ['cable'], 'beginner'],
  ['db_overhead_triceps', 'triceps_extension', 'Überkopf-Trizeps Kurzhantel', ['overhead dumbbell extension', 'french press'], { equipment: 'dumbbell', execution: 'overhead' }, ['dumbbell'], 'beginner'],
  ['skull_crusher', 'triceps_extension', 'Skull Crusher SZ-Stange', ['skull crusher', 'lying triceps extension'], { equipment: 'ez_bar', execution: 'lying' }, ['ez_bar', 'bench'], 'intermediate'],
  ['db_skull_crusher', 'triceps_extension', 'Skull Crusher Kurzhantel', [], { equipment: 'dumbbell', execution: 'lying' }, ['dumbbell', 'bench'], 'intermediate'],
  ['triceps_kickback', 'triceps_extension', 'Trizeps-Kickbacks', ['kickback'], { equipment: 'dumbbell', execution: 'kickback' }, ['dumbbell'], 'beginner', { uni: true }],
  ['jm_press', 'triceps_extension', 'JM Press', [], { equipment: 'barbell', execution: 'jm' }, ['barbell', 'bench'], 'advanced'],
  ['triceps_machine', 'triceps_extension', 'Trizepsmaschine', ['triceps machine'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['wrist_curl', 'wrist', 'Handgelenkcurls', ['wrist curl'], { equipment: 'barbell' }, ['barbell', 'bench'], 'beginner'],
  ['reverse_wrist_curl', 'wrist', 'Handgelenkcurls Obergriff', ['reverse wrist curl'], { equipment: 'dumbbell', grip: 'overhand' }, ['dumbbell'], 'beginner'],
  ['dead_hang', 'wrist', 'Dead Hang', ['hängen'], { equipment: 'bodyweight' }, ['pullup_bar'], 'beginner', { bw: true, mus: { forearms: [1, 'direct'], lats: [0.3, 'indirect'] } }],
  /* Rumpf */
  ['crunch', 'crunch', 'Crunch', ['crunches', 'sit-up'], { equipment: 'bodyweight' }, ['bodyweight'], 'beginner', { bw: true }],
  ['cable_crunch', 'crunch', 'Cable Crunch', ['kneeling cable crunch'], { equipment: 'cable', grip: 'rope' }, ['cable'], 'beginner'],
  ['ab_machine', 'crunch', 'Bauchmaschine', ['ab machine', 'ab crunch machine'], { equipment: 'machine' }, ['machine'], 'beginner'],
  ['decline_crunch', 'crunch', 'Crunch Negativbank', ['decline sit-up'], { equipment: 'bodyweight', angle: 'decline' }, ['bench'], 'intermediate', { bw: true }],
  ['hanging_leg_raise', 'leg_raise', 'Beinheben hängend', ['hanging leg raise', 'toes to bar'], { equipment: 'bodyweight', execution: 'hanging' }, ['pullup_bar'], 'intermediate', { bw: true }],
  ['hanging_knee_raise', 'leg_raise', 'Knieheben hängend', ['hanging knee raise', 'captains chair'], { equipment: 'bodyweight', execution: 'hanging_knee' }, ['pullup_bar'], 'beginner', { bw: true }],
  ['lying_leg_raise', 'leg_raise', 'Beinheben liegend', ['lying leg raise'], { equipment: 'bodyweight', execution: 'lying' }, ['bodyweight'], 'beginner', { bw: true }],
  ['reverse_crunch', 'leg_raise', 'Reverse Crunch', [], { equipment: 'bodyweight' }, ['bodyweight'], 'beginner', { bw: true }],
  ['ab_wheel', 'plank', 'Ab Wheel', ['ab roller', 'ab-roller'], { equipment: 'bodyweight', execution: 'rollout' }, ['bodyweight'], 'intermediate', { bw: true, mus: { abs: [1, 'direct'], lats: [0.3, 'indirect'] } }],
  ['plank', 'plank', 'Plank', ['unterarmstütz', 'forearm plank'], { equipment: 'bodyweight' }, ['bodyweight'], 'beginner', { bw: true }],
  ['side_plank', 'plank', 'Side Plank', ['seitstütz'], { equipment: 'bodyweight', execution: 'side' }, ['bodyweight'], 'beginner', { bw: true, uni: true }],
  ['plank_weighted', 'plank', 'Plank mit Zusatzlast', [], { equipment: 'bodyweight', execution: 'weighted' }, ['plate'], 'intermediate', { bw: true }],
  ['hollow_hold', 'plank', 'Hollow Body Hold', ['hollow hold'], { equipment: 'bodyweight', execution: 'hollow' }, ['bodyweight'], 'intermediate', { bw: true }],
  ['dead_bug', 'plank', 'Dead Bug', [], { equipment: 'bodyweight', execution: 'dead_bug' }, ['bodyweight'], 'beginner', { bw: true }],
  ['bird_dog', 'plank', 'Bird Dog', [], { equipment: 'bodyweight', execution: 'bird_dog' }, ['bodyweight'], 'beginner', { bw: true, mus: { abs: [1, 'direct'], lower_back: [0.5, 'indirect'], glutes: [0.4, 'indirect'] } }],
  ['pallof_press', 'anti_rotation', 'Pallof Press', ['pallof'], { equipment: 'cable' }, ['cable', 'band'], 'beginner', { uni: true }],
  ['cable_woodchop', 'rotation', 'Woodchop Kabel', ['woodchop', 'cable chop'], { equipment: 'cable' }, ['cable'], 'beginner', { uni: true }],
  ['russian_twist', 'rotation', 'Russian Twist', [], { equipment: 'bodyweight' }, ['bodyweight', 'plate'], 'beginner', { bw: true }],
  ['landmine_rotation', 'rotation', 'Landmine Rotation', [], { equipment: 'barbell', execution: 'landmine' }, ['barbell'], 'intermediate'],
  ['farmer_carry', 'carry', 'Farmer’s Walk', ['farmer walk', 'farmer carry', 'farmer'], { equipment: 'dumbbell' }, ['dumbbell', 'kettlebell'], 'beginner'],
  ['suitcase_carry', 'carry', 'Suitcase Carry', [], { equipment: 'dumbbell', execution: 'single_arm' }, ['dumbbell', 'kettlebell'], 'beginner', { uni: true, mus: { abs: [1, 'direct'], forearms: [0.8, 'indirect'], traps: [0.4, 'indirect'] } }],
  ['overhead_carry', 'carry', 'Overhead Carry', [], { equipment: 'dumbbell', execution: 'overhead' }, ['dumbbell', 'kettlebell'], 'intermediate', { mus: { front_delts: [1, 'direct'], abs: [0.6, 'indirect'], traps: [0.5, 'indirect'] } }],
  /* Plyo */
  ['box_jump', 'plyo', 'Box Jumps', ['box jump'], { equipment: 'bodyweight' }, ['box'], 'intermediate', { bw: true }],
  ['broad_jump', 'plyo', 'Standweitsprung', ['broad jump'], { equipment: 'bodyweight' }, ['open_floor'], 'intermediate', { bw: true }],
  ['jump_squat', 'plyo', 'Jump Squats', ['jump squat'], { equipment: 'bodyweight' }, ['open_floor'], 'intermediate', { bw: true }],
  ['pogo_hops', 'plyo', 'Pogo Hops', ['pogos'], { equipment: 'bodyweight' }, ['open_floor'], 'beginner', { bw: true, mus: { calves: [1, 'direct'], quads: [0.3, 'indirect'] } }]
];
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const arr = a => "array[" + (a || []).map(q).join(',') + "]::text[]";
const NEW_PATTERNS = [['shoulder_flexion', 'Schulterflexion'], ['shoulder_elevation', 'Schulterhebung'], ['wrist_flexion', 'Handgelenk']];
const NEW_EQUIP = [['ez_bar', 'SZ-Stange'], ['trap_bar', 'Trap Bar'], ['t_bar', 'T-Bar'], ['plate', 'Hantelscheibe'], ['box', 'Box / Erhöhung']];
const seen = {}; X.forEach(x => { if (seen[x[0]]) throw new Error('dup ' + x[0]); seen[x[0]] = 1; if (!M[x[1]]) throw new Error('base ' + x[1]); });
let out = [];
out.push(`-- ============================================================
--  ORVIA · 0047 — Übungskatalog als Basisbewegung × Variante (S2b-1, 14.09.2026)
--  Generiert aus app/tools/catalog-gen.mjs. Idempotent, löscht nichts.
--  · exercises.base_slug + exercises.variant {equipment, grip, angle, execution}
--  · ${X.length} Systemübungen (${Object.keys(M).length} Basisbewegungen); bestehende Slugs behalten Name,
--    bekommen base_slug/variant/Aliasse (nur wenn leer) und fehlende Muskel-/Gerätezuordnungen
--  · Muskelzuordnung ist die Wahrheit für gym-volume/Kraftprofil (Client liest sie ab v8-380 mit)
-- ============================================================
alter table public.exercises add column if not exists base_slug text;
alter table public.exercises add column if not exists variant jsonb not null default '{}'::jsonb;
create index if not exists exercises_base_idx on public.exercises (base_slug);
insert into public.movement_patterns (key, name) values ${NEW_PATTERNS.map(p => `(${q(p[0])},${q(p[1])})`).join(',')} on conflict (key) do nothing;
insert into public.equipment (key, name) values ${NEW_EQUIP.map(p => `(${q(p[0])},${q(p[1])})`).join(',')} on conflict (key) do nothing;
`);
out.push(`insert into public.exercises (slug, is_system, name, aliases, category, movement_pattern, difficulty, unilateral, bodyweight, base_slug, variant) values`);
out.push(X.map(x => {
  const [slug, base, name, aliases, variant, equip, diff, f] = x; const F = f || {};
  const cat = (M[base].pattern === 'stability' || M[base].pattern === 'anti_rotation') ? 'stability' : (M[base].pattern === 'jump' ? 'plyometric' : (['lateral_raise', 'front_raise', 'rear_delt', 'face_pull', 'shrug', 'chest_fly', 'pullover', 'leg_curl', 'leg_extension', 'calf_raise', 'hip_adduction', 'hip_abduction', 'glute_kickback', 'biceps_curl', 'hammer_curl', 'triceps_extension', 'wrist', 'crunch', 'leg_raise', 'rotation'].indexOf(base) >= 0 ? 'isolation' : 'compound'));
  return ` (${q(slug)},true,${q(name)},${arr(aliases)},${q(cat)},${q(M[base].pattern)},${q(diff)},${F.uni ? 'true' : 'false'},${F.bw ? 'true' : 'false'},${q(base)},${q(JSON.stringify(variant))}::jsonb)`;
}).join(',\n'));
out.push(`on conflict (slug) do update set
  base_slug = excluded.base_slug,
  variant = excluded.variant,
  movement_pattern = coalesce(public.exercises.movement_pattern, excluded.movement_pattern),
  aliases = case when coalesce(cardinality(public.exercises.aliases), 0) = 0 then excluded.aliases else public.exercises.aliases end;
`);
const mus = [];
X.forEach(x => { const [slug, base, , , , , , f] = x; const mm = (f && f.mus) || M[base].mus; Object.keys(mm).forEach(k => mus.push(`(${q(slug)},${q(k)},${mm[k][0]},${q(mm[k][1])})`)); });
out.push(`insert into public.exercise_muscles (exercise_id, muscle_key, weight, involvement)
 select e.id, v.mk, v.w, v.inv from public.exercises e join (values
${mus.join(',\n')}
 ) as v(slug, mk, w, inv) on e.slug = v.slug
on conflict (exercise_id, muscle_key) do nothing;
`);
const eq = [];
X.forEach(x => { const [slug, , , , , equip] = x; (equip || []).forEach(k => eq.push(`(${q(slug)},${q(k)})`)); });
out.push(`insert into public.exercise_equipment (exercise_id, equipment_key)
 select e.id, v.ek from public.exercises e join (values
${eq.join(',\n')}
 ) as v(slug, ek) on e.slug = v.slug
on conflict (exercise_id, equipment_key) do nothing;
`);
out.push(`insert into public.schema_migrations(version) values ('0047_exercise_catalog_variants') on conflict (version) do nothing;`);
process.stdout.write(out.join('\n'));
console.error('exercises:', X.length, 'bases:', Object.keys(M).length, 'muscle rows:', mus.length, 'equipment rows:', eq.length);
