
CREATE TABLE IF NOT EXISTS users (
  username text PRIMARY key,
  password text not null
);

CREATE TABLE IF NOT EXISTS todolists (
  id SERIAL PRIMARY KEY,
  title varchar(100) unique not null,
  username text
  not null
  references users (username)
  on delete cascade
);

CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  title varchar(100) not null,
  done boolean default false,
  todolist_id integer
    not null
    references todolists (id)
    on delete cascade,
  username text
    not null
    references users (username)
    on delete cascade

);
