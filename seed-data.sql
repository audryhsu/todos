INSERT INTO todolists(title) VALUES
('Work Todos'),
('Home Todos'),
('Additional Todos'),
('social todos');

INSERT INTO todos(title, done, todolist_id) VALUES
('Get coffee', true, (select todolists.id from todolists where title = 'Work Todos')),
('Chat with co-workers', true, (select todolists.id from todolists where title = 'Work Todos')),
('Duck out of meeting', false, (select todolists.id from todolists where title = 'Work Todos')),
('Feed the cats', true, (select todolists.id from todolists where title = 'Home Todos')),
('Go to bed', true, (select todolists.id from todolists where title = 'Home Todos')),
('Buy milk', true, (select todolists.id from todolists where title = 'Home Todos')),
('Study for launch school', true, (select todolists.id from todolists where title = 'social todos')),
('Go to libby''s birthday paty', false, (select todolists.id from todolists where title = 'social todos'))
;
