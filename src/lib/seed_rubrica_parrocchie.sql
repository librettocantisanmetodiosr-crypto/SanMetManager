-- ═══════════════════════════════════════════════════
-- SEED: Parrocchie del Vicariato Urbano di Siracusa
-- Fonte: Arcidiocesi di Siracusa (2024)
-- Eseguire una sola volta in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════

insert into public.rubrica (nome_ente, referente, telefono, email, note) values
  ('Metropolitana Natività di Maria SS.ma (Cattedrale)', 'Parroco', '0931 65328', 'cattedrale.siracusa@alice.it', 'Piazza Duomo, 5'),
  ('Basilica Santuario Madonna delle Lacrime',           'Rettore',  '0931 21446', 'rettore@madonnadellelacrime.it', 'Via del Santuario, 33'),
  ('Maria Madre della Chiesa',                           'Parroco',  '0931 702755', null, 'Via Alessandro Specchi, 98'),
  ('Maria Madre di Dio',                                 'Parroco',  '0931 757544', null, 'Viale San Panagia, 135'),
  ('Maria SS.ma Addolorata (Grottasanta)',                'Parroco',  '0931 1622769', 'parrocchiagrottasanta@gmail.com', 'Via dei Servi di Maria, 8'),
  ('Maria SS.ma Mediatrice di tutte le Grazie',          'Parroco',  '389 4455602', null, 'Contrada Isola'),
  ('Maria SS.ma della Misericordia e dei Pericoli',      'Parroco',  '0931 33338', null, 'Piazza Cappuccini, 2'),
  ('Maria Stella del Mare',                              'Parroco',  null, null, 'Via Tersicore, 15 (Fontane Bianche)'),
  ('Sant''Antonio di Padova',                            'Parroco',  '0931 492822', 's.antoniosr@alice.it', 'Via A. Lo Surdo, 13'),
  ('San Corrado Confalonieri',                           'Parroco',  '0931 704104', 'sancorrado@virgilio.it', 'Piazza Tor di San Francesco'),
  ('San Francesco d''Assisi',                            'Parroco',  '0931 740458', null, 'Viale Epipoli'),
  ('San Giacomo Apostolo ai Miracoli',                   'Parroco',  '0931 65210', null, 'Via dei Miracoli'),
  ('San Giovanni Battista all''Immacolata',              'Parroco',  '0931 67017', 'parrocchiaimmacolasr@gmail.com', 'Piazza San Filippo'),
  ('San Giovanni Evangelista e San Marziano',            'Parroco',  '346 1238715', null, 'Piazzale S. Marziano'),
  ('San Giuseppe (Cassibile)',                           'Parroco',  '0931 718895', null, 'Via Fiume Cacipari, 8'),
  ('San Luca',                                           'Parroco',  '0931 724083', null, 'Via Testaferrata, 1 (Osp. Umberto I)'),
  ('Santa Lucia al Sepolcro',                            'Parroco',  '0931 67946', 'parrocchia@basilicasantalucia.com', 'Via Luigi Bignami, 1'),
  ('Santa Maria della Consolazione (Belvedere)',         'Parroco',  '0931 711381', 's.mariaconsolazionebelvedere@gmail.com', 'Via Poggio del Carancino, 62'),
  ('San Martino Vescovo',                                'Parroco',  '0931 24385', null, 'Via San Martino, 1'),
  ('San Metodio',                                        'Parroco',  null, 'parrocchiasanmetodio@email.it', 'Piazza San Metodio, 1 (Via Italia, 103)'),
  ('San Paolo Apostolo',                                 'Parroco',  null, null, 'Via dell''Apollonion'),
  ('San Pietro al Carmine',                              'Parroco',  '0931 66056', 'g.lombardo.sr@gmail.com', 'Piazza del Carmine'),
  ('Santa Rita',                                         'Parroco',  '0931 66151', 'rita.santa@virgilio.it', 'Corso Gelone, 93'),
  ('San Tommaso Apostolo al Pantheon',                   'Parroco',  '0931 60100', null, 'Via A. Diaz, 1'),
  ('Sacra Famiglia',                                     'Parroco',  '0931 758370', 'parrocchia.sfamiglia@alice.it', 'Viale dei Comuni, 14'),
  ('Sacro Cuore di Gesù',                                'Parroco',  '0931 36311', 'sacro.cuore@asweb.it', 'Piazza Giovanni XXIII'),
  ('Santissimo Salvatore',                               'Parroco',  '0931 414844', null, 'Via Necropoli Grotticelle, 60')
on conflict do nothing;
