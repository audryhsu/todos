const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const store = require("connect-loki");
// const SessionPersistence = require('./lib/session-persistence')
const PgPersistence = require('./lib/pg-persistence');
const Client = require('pg');
const catchError = require('./lib/catch-error');

const app = express();
const host = "localhost";
const port = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
// setting up the session
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

app.use(flash());

// Create a new database -- instead of using session store directly
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session); // constructor needs access persisted data
  next();
})

// Extract session info
// data in res.locals can be passed between middleware functions and are available to all views
// note: this is why we don't need to pass in username and singedIn for every res.render() call
app.use((req, res, next) => {
  res.locals.username = req.session.username
  res.locals.signedIn = req.session.signedIn
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Detect unauthorized access to routes
const requiresAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    res.redirect(302, "/users/signin")
  } else {
    next();
  }
}
// Redirect start page
app.get("/", (req, res) => {
  res.redirect("/lists");
});

// Render the list of todo lists
app.get("/lists", requiresAuthentication, catchError(async (req, res, next) => {
  let store = res.locals.store;
  let todoLists = await store.sortedTodoLists();

  let todosInfo = todoLists.map(todoList => ({
    countAllTodos: todoList.todos.length,
    countDoneTodos: todoList.todos.filter(todo => todo.done).length,
    isDone: store.isDoneTodoList(todoList),
  }));

    res.render("lists", {
      todoLists,
      todosInfo, // pass in array of todolist info to view
    });

  })
);

// Render new todo list page
app.get("/lists/new", requiresAuthentication, (req, res) => {
  res.render("new-list", {
  });
});

// Create a new todo list
app.post("/lists",
  requiresAuthentication,
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
  ],
  catchError( async(req, res) => {
    let rerenderNewList = () => {
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
        username: req.session.username,
        signedIn: req.session.signedIn,
      });
    }

    let store = res.locals.store;

    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderNewList();
    } else if (! await store.createNewTodoList(req.body.todoListTitle)) {
      req.flash("error","Title must be unique.");
      rerenderNewList();
    } else {
      req.flash("success", "The todo list has been created.");
      res.redirect("/lists");
    }
  })
);

// Render individual todo list and its todos
app.get("/lists/:todoListId", requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store
    let todoList = await store.loadTodoList(+todoListId);

    if (todoList === undefined) {
      // next(new Error("Not found."));
      throw new Error("not found.") // we can simply throw error since catchError module will catch error if middleware (now a promise) is rejected and pass it to next
    }

    todoList.todos = await store.sortedTodos(todoList);

    res.render("list", {
      todoList,
      isDoneTodoList: store.isDoneTodoList(todoList),
      hasUndoneTodos: store.hasUndoneTodos(todoList),
    });
  })
);


// Toggle completion status of a todo
app.post("/lists/:todoListId/todos/:todoId/toggle",
  requiresAuthentication,
  catchError(async (req, res) => {
    let { todoListId, todoId } = { ...req.params };
    let store = res.locals.store;

    let toggled = await store.toggleDoneTodo(+todoListId, +todoId);

    if (!toggled) throw new Error("Not found.")

    let todo = await store.loadTodo(+todoListId, +todoId);

    if (todo.done) {
      req.flash("success", `"${todo.title}" marked done.`);
    } else {
      req.flash("success", `"${todo.title}" marked as NOT done!`);
    }

    res.redirect(`/lists/${todoListId}`);
  })
);

// Delete a todo
app.post("/lists/:todoListId/todos/:todoId/destroy",
  requiresAuthentication,
  catchError(async (req, res) => {
    let { todoListId, todoId } = { ...req.params };
    let store = res.locals.store;

    let todoList = await store.loadTodoList(+todoListId);
    let deleted = await store.removeTodo(+todoListId, +todoId);

    if (!deleted) {
      throw new Error("Not found.");
    } else {
        req.flash("success", "The todo has been deleted.");
        res.redirect(`/lists/${todoListId}`);
    }
  })
);

// Mark all todos as done
app.post("/lists/:todoListId/complete_all",
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store

    let completed = await store.completeAllTodos(+todoListId)

    if (!completed) throw new Error("Not found.");
    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  })
);

// Create a new todo and add it to the specified list
app.post("/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters."),
  ],
  catchError(async (req, res, next) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store;
    let todoList = await store.loadTodoList(+todoListId);

    if (!todoList) throw new Error("Not found.");
    let errors = validationResult(req); // extracts validation errors from req and puts it into an object

    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));

      todoList.todos = await store.sortedTodos(todoList)

      res.render("list", {
        flash: req.flash(),
        todoList,
        isDoneTodoList: store.isDoneTodoList(todoList),
        hasUndoneTodos: store.hasUndoneTodos(todoList),
        todoTitle: req.body.todoTitle,
      });
    } else {
      let todoCreated = await store.createTodo(req.body.todoTitle, +todoListId);

      if (!todoCreated) throw new Error("Couldn't create Todo.");

      req.flash("success", "The todo has been created.");
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

// Render edit todo list form
app.get("/lists/:todoListId/edit", requiresAuthentication,
  catchError( async(req, res) => {
    let todoListId = req.params.todoListId;
    let store = res.locals.store;

    let todoList = await store.loadTodoList(+todoListId);
    if (!todoList) throw new Error("Not found.");

    res.render("edit-list", { todoList,
    });
  })
);

// Delete todo list
app.post("/lists/:todoListId/destroy",
requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;

    let store = res.locals.store

    let deleted = await store.deleteTodoList(+todoListId)

    if (!deleted) throw new Error("Not found.");

    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
));

// Edit todo list title
app.post("/lists/:todoListId/edit",
requiresAuthentication,
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
  ],
  catchError( async(req, res) => {
    let todoListId = req.params.todoListId;
    let title = req.body.todoListTitle
    let store = res.locals.store;

    let rerenderEditList = async () => {
      let todoList = await res.locals.store.loadTodoList(+todoListId);
      if (!todoList) {
        next(new Error("Not found."));
      }
       else {
        res.render("edit-list", {
          flash: req.flash(),
          todoListTitle: title,
          todoList,
        });
      }
    }

    try {
      let errors = validationResult(req);

      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        rerenderEditList();
      }
      else if (await store.existsTodoListTitle(title)) {
        req.flash("error", "The list title must be unique.")
        rerenderEditList();

      } else if (!await store.setListTitle(+todoListId, title)) {
        throw new Error("Not found.")
      } else {
        req.flash("success", "Todo list updated.");
        res.redirect(`/lists/${todoListId}`);
      }

    } catch (error) {
    if (store.isUniqueConstraintViolation(error)) {
      req.flash("error", "The list title must be unique");
      rerenderEditList();
    } else {
      throw error;
    }
  }
})
);

// Render sign in page
app.get("/users/signin", (req, res) => {
  req.flash("info", "Please sign in.")
  res.render("signin", {
    flash: req.flash(),
  })
})

// Sign admin in and redirect to /lists url
app.post("/users/signin", catchError(async (req, res) => {
  let username = req.body.username.trim()
  let password = req.body.password
  let authenticated = await res.locals.store.authenticateUser(username, password)

  if (!authenticated) {
    req.flash("error", "Invalid credentials.")
    res.render("signin", {
      flash: req.flash(),
      username: username,
    })
  }
  req.session.username = username
  req.session.signedIn = true;
  req.flash("info",  "Welcome!")
  res.redirect("/lists")
})
)

// Sign user out
app.post("/users/signout", (req, res) => {
  delete req.session.username;
  delete req.session.signedIn
  res.redirect("/users/signin")
})

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});
