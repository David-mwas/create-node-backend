#!/usr/bin/env node

import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import https from "https";

const CURR_DIR = process.cwd();

// ✅ Safe file writer
const write = (filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, "utf-8");
  } catch (err) {
    console.error(chalk.red(`❌ Failed to write file: ${filePath}`), err);
  }
};

// ✅ Safe folder creation
const createFolder = (folderPath) => {
  try {
    fs.mkdirSync(folderPath, { recursive: true });
  } catch (err) {
    console.error(chalk.red(`❌ Failed to create folder: ${folderPath}`), err);
  }
};

// ✅ Validate project name
const validateProjectName = (name) => /^[a-zA-Z0-9-_]+$/.test(name);

// ✅ Auto-increment if folder exists
const getAvailableProjectName = (baseName) => {
  let name = baseName;
  let counter = 1;
  while (fs.existsSync(path.join(CURR_DIR, name))) {
    name = `${baseName}${counter}`;
    counter++;
  }
  return name;
};

// ✅ Better network check (hit npm registry)
const checkNetwork = async () =>
  new Promise((resolve) => {
    const req = https.get("https://registry.npmjs.org/", (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });

// ✅ Run command safely
const runCommand = (cmd, cwd) => {
  try {
    execSync(cmd, { stdio: "inherit", cwd });
  } catch (err) {
    console.error(chalk.red(`❌ Failed to run: ${cmd}`));
    process.exit(1);
  }
};

const packages = {
  express: ["express", "dotenv", "cors"],
  fastify: ["fastify", "dotenv", "cors"],
  hono: ["hono", "dotenv"],
  sequelize: ["sequelize", "pg", "mysql2"],
  dev: ["typescript", "@types/node", "@types/express", "ts-node-dev"],
};

const getIndexTemplate = (framework, ext, db) => {
  const importExt = ext === "ts" ? "" : ".js";
  const importDB =
    db !== "none"
      ? `import { connectDB } from './config/db${importExt}';\n`
      : "";
  const connectCall = db !== "none" ? `connectDB();\n` : "";

  if (framework === "express") {
    return `import express from 'express';
import dotenv from 'dotenv';
${importDB}import userRoutes from './routes/user.route${importExt}';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Create Node Backend CLI' });
});

app.listen(process.env.PORT || 5000, () => {
  console.log(\`🚀 Server running on http://localhost:\${process.env.PORT || 5000}\`);
});

${connectCall}`;
  }

  if (framework === "fastify") {
    return `import Fastify from 'fastify';
import dotenv from 'dotenv';
${importDB}dotenv.config();

const app = Fastify();
app.get('/', async () => ({ hello: 'world' }));

app.listen({ port: Number(process.env.PORT) || 5000 }, (err, address) => {
  if (err) throw err;
  console.log(\`🚀 Server listening at \${address}\`);
});

${connectCall}`;
  }

  if (framework === "hono") {
    return `import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();
app.get('/', (c) => c.json({ message: 'Hello from Hono' }));

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 5000 });`;
  }
};

const getDBTemplate = (db, ext) => {
  if (db === "mongodb") {
    return `import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI${ext === "ts" ? "!" : ""});
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ DB connection error:', err);
    process.exit(1);
  }
};`;
  }

  if (["postgres", "mysql"].includes(db)) {
    return `import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(process.env.DB_URI${ext === "ts" ? "!" : ""});

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ SQL DB connected');
  } catch (err) {
    console.error('❌ DB connection error:', err);
    process.exit(1);
  }
};`;
  }

  return "// No DB config";
};

const getModel = (db, ext) => {
  const importExt = ext === "ts" ? "" : ".js";

  if (db === "mongodb") {
    return `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

export const User = mongoose.model('User', userSchema);`;
  }

  return `import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db${importExt}';

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false }
});`;
};

const getController = (ext) => {
  const importExt = ext === "ts" ? "" : ".js";

  if (ext === "ts") {
    return `import { Request, Response } from 'express';
import { User } from '../models/user.model';

export const getAllUsers = async (req: Request, res: Response) => {
  const users = await User.findAll();
  res.json(users);
};`;
  }

  return `import { User } from '../models/user.model${importExt}';

export const getAllUsers = async (req, res) => {
  const users = await User.findAll();
  res.json(users);
};`;
};

const getRoute = (ext) => {
  const importExt = ext === "ts" ? "" : ".js";

  if (ext === "ts") {
    return `import { Router } from 'express';
import { getAllUsers } from '../controllers/user.controller';

const router = Router();
router.get('/', getAllUsers);
export default router;`;
  }

  return `import { Router } from 'express';
import { getAllUsers } from '../controllers/user.controller${importExt}';

const router = Router();
router.get('/', getAllUsers);
export default router;`;
};

const main = async () => {
  console.log(chalk.cyan("\n🛠  Create Node Backend CLI\n"));

  let { projectName, framework, db, useTS } = await inquirer.prompt([
    { name: "projectName", message: "Project name:" },
    {
      type: "list",
      name: "framework",
      message: "Choose a backend framework:",
      choices: ["express", "fastify", "hono"],
    },
    {
      type: "list",
      name: "db",
      message: "Select a database:",
      choices: ["mongodb", "postgres", "mysql", "none"],
    },
    {
      type: "confirm",
      name: "useTS",
      message: "Use TypeScript?",
      default: true,
    },
  ]);

  if (!validateProjectName(projectName)) {
    console.log(chalk.yellow("⚠ Invalid project name, using safe default."));
    projectName = "my-backend-app";
  }
  projectName = getAvailableProjectName(projectName);

  const ext = useTS ? "ts" : "js";
  const projectPath = path.join(CURR_DIR, projectName);
  createFolder(projectPath);

  const dirs = ["src/config", "src/models", "src/controllers", "src/routes"];
  dirs.forEach((dir) => createFolder(path.join(projectPath, dir)));

  // index
  write(
    path.join(projectPath, `src/index.${ext}`),
    getIndexTemplate(framework, ext, db)
  );

  // db + mvc
  if (db !== "none") {
    write(
      path.join(projectPath, `src/config/db.${ext}`),
      getDBTemplate(db, ext)
    );
    write(
      path.join(projectPath, `src/models/user.model.${ext}`),
      getModel(db, ext)
    );

    if (framework === "express") {
      write(
        path.join(projectPath, `src/controllers/user.controller.${ext}`),
        getController(ext)
      );
      write(
        path.join(projectPath, `src/routes/user.route.${ext}`),
        getRoute(ext)
      );
    }
  }

  // env
  write(
    path.join(projectPath, `.env`),
    `PORT=5000\n${
      (db === "mongodb" &&
        `MONGO_URI=mongodb://localhost:27017/${projectName}`) ||
      (["postgres", "mysql"].includes(db) && "DB_URI=db-url") ||
      ""
    }`
  );

  // package.json
  const deps = [...packages[framework]];
  if (db === "mongodb") deps.push("mongoose");
  if (["postgres", "mysql"].includes(db)) deps.push(...packages.sequelize);
  const devDeps = useTS ? packages.dev : [];

  const pkgJson = {
    name: projectName,
    version: "1.0.0",
    main: `src/index.${ext}`,
    type: useTS ? undefined : "module",
    scripts: {
      dev: useTS
        ? "ts-node-dev --respawn --transpile-only src/index.ts"
        : "node --watch src/index.js",
      start: useTS
        ? "ts-node-dev --respawn --transpile-only src/index.ts"
        : "node src/index.js",
    },
    dependencies: {},
    devDependencies: {},
  };

  write(
    path.join(projectPath, "package.json"),
    JSON.stringify(pkgJson, null, 2)
  );

  // misc
  write(
    path.join(projectPath, ".gitignore"),
    "node_modules\n.env\n.env.local\ndist\n"
  );
  write(
    path.join(projectPath, "README.md"),
    `# ${projectName}\nGenerated with Create Node Backend CLI`
  );

  if (useTS) {
    write(
      path.join(projectPath, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            module: "commonjs",
            outDir: "dist",
            rootDir: "src",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ["src"],
          exclude: ["node_modules", "dist"],
        },
        null,
        2
      )
    );
  }

  console.log(chalk.green("\n📦 Installing dependencies...\n"));

  // const deps = [...packages[framework]];
  if (db === "mongodb") deps.push("mongoose");
  if (["postgres", "mysql"].includes(db)) deps.push(...packages.sequelize);
  // const devDeps = useTS ? packages.dev : [];

  // ✅ Interactive retry watcher
  const installDeps = async () => {
    const online = await checkNetwork();
    if (!online) {
      console.log(chalk.red("❌ No internet connection."));
      console.log(chalk.yellow("🔄 Retrying in 5s... (press 'q' to quit)"));

      // Listen for keypress once
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", (key) => {
        if (key.toString().toLowerCase() === "q") {
          console.log(chalk.red("\n👋 Quit installation watcher."));
          process.exit(0);
        }
      });

      setTimeout(installDeps, 5000);
      return;
    }
    console.log(chalk.green("🌐 Internet detected, installing packages..."));
    runCommand(`npm install ${deps.join(" ")}`, projectPath);
    if (devDeps.length)
      runCommand(`npm install -D ${devDeps.join(" ")}`, projectPath);

    console.log(chalk.green(`\n✅ Project ${projectName} is ready!\n`));
    console.log(chalk.yellow(`👉 cd ${projectName} && npm run dev\n`));
    process.exit(0);
  };

  installDeps();
};
main();

// #!/usr/bin/env node

// import inquirer from "inquirer";
// import fs from "fs";
// import path from "path";
// import { execSync } from "child_process";
// import chalk from "chalk";

// const CURR_DIR = process.cwd();

// const write = (filePath, content) =>
//   fs.writeFileSync(filePath, content, "utf-8");

// const createFolder = (folderPath) =>
//   fs.mkdirSync(folderPath, { recursive: true });

// const packages = {
//   express: ["express", "dotenv", "cors"],
//   fastify: ["fastify", "dotenv", "cors"],
//   hono: ["hono", "dotenv"],
//   sequelize: ["sequelize", "pg", "mysql2"],
//   dev: ["typescript", "@types/node", "@types/express", "ts-node-dev"],
// };

// // ✅ Fix: respect .js extension for JS projects
// const getIndexTemplate = (framework, ext, db) => {
//   const importExt = ext === "ts" ? "" : ".js";
//   const importDB =
//     db !== "none"
//       ? `import { connectDB } from './config/db${importExt}';\n`
//       : "";
//   const connectCall = db !== "none" ? `connectDB();\n` : "";

//   if (framework === "express") {
//     return `import express from 'express';
// import dotenv from 'dotenv';
// ${importDB}import userRoutes from './routes/user.route${importExt}';

// dotenv.config();

// const app = express();
// app.use(express.json());
// app.use('/api/users', userRoutes);

// app.get('/', (req, res) => {
//   res.json({ message: 'Hello from Create Node Backend CLI' });
// });

// app.listen(process.env.PORT || 5000, () => {
//   console.log(\`🚀 Server running on http://localhost:\${process.env.PORT || 5000}\`);
// });

// ${connectCall}`;
//   }

//   if (framework === "fastify") {
//     return `import Fastify from 'fastify';
// import dotenv from 'dotenv';
// ${importDB}dotenv.config();

// const app = Fastify();
// app.get('/', async () => ({ hello: 'world' }));

// app.listen({ port: Number(process.env.PORT) || 5000 }, (err, address) => {
//   if (err) throw err;
//   console.log(\`🚀 Server listening at \${address}\`);
// });

// ${connectCall}`;
//   }

//   if (framework === "hono") {
//     return `import { Hono } from 'hono';
// import { serve } from '@hono/node-server';
// import dotenv from 'dotenv';

// dotenv.config();

// const app = new Hono();
// app.get('/', (c) => c.json({ message: 'Hello from Hono' }));

// serve({ fetch: app.fetch, port: Number(process.env.PORT) || 5000 });`;
//   }
// };

// const getDBTemplate = (db, ext) => {
//   if (db === "mongodb") {
//     return `import mongoose from 'mongoose';

// export const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI${ext === "ts" ? "!" : ""});
//     console.log('✅ MongoDB connected');
//   } catch (err) {
//     console.error('❌ DB connection error:', err);
//     process.exit(1);
//   }
// };`;
//   }

//   if (["postgres", "mysql"].includes(db)) {
//     return `import { Sequelize } from 'sequelize';

// export const sequelize = new Sequelize(process.env.DB_URI${ext === "ts" ? "!" : ""});

// export const connectDB = async () => {
//   try {
//     await sequelize.authenticate();
//     console.log('✅ SQL DB connected');
//   } catch (err) {
//     console.error('❌ DB connection error:', err);
//     process.exit(1);
//   }
// };`;
//   }

//   return "// No DB config";
// };

// const getModel = (db, ext) => {
//   const importExt = ext === "ts" ? "" : ".js";

//   if (db === "mongodb") {
//     return `import mongoose from 'mongoose';

// const userSchema = new mongoose.Schema({
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true }
// });

// export const User = mongoose.model('User', userSchema);`;
//   }

//   return `import { DataTypes } from 'sequelize';
// import { sequelize } from '../config/db${importExt}';

// export const User = sequelize.define('User', {
//   id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
//   email: { type: DataTypes.STRING, allowNull: false, unique: true },
//   password: { type: DataTypes.STRING, allowNull: false }
// });`;
// };

// const getController = (ext) => {
//   const importExt = ext === "ts" ? "" : ".js";

//   if (ext === "ts") {
//     return `import { Request, Response } from 'express';
// import { User } from '../models/user.model';

// export const getAllUsers = async (req: Request, res: Response) => {
//   const users = await User.findAll();
//   res.json(users);
// };`;
//   }

//   return `import { User } from '../models/user.model${importExt}';

// export const getAllUsers = async (req, res) => {
//   const users = await User.findAll();
//   res.json(users);
// };`;
// };

// const getRoute = (ext) => {
//   const importExt = ext === "ts" ? "" : ".js";

//   if (ext === "ts") {
//     return `import { Router } from 'express';
// import { getAllUsers } from '../controllers/user.controller';

// const router = Router();
// router.get('/', getAllUsers);
// export default router;`;
//   }

//   return `import { Router } from 'express';
// import { getAllUsers } from '../controllers/user.controller${importExt}';

// const router = Router();
// router.get('/', getAllUsers);
// export default router;`;
// };

// const main = async () => {
//   console.log(chalk.cyan("\n🛠  Create Node Backend CLI\n"));

//   const { projectName, framework, db, useTS } = await inquirer.prompt([
//     { name: "projectName", message: "Project name:" },
//     {
//       type: "list",
//       name: "framework",
//       message: "Choose a backend framework:",
//       choices: ["express", "fastify", "hono"],
//     },
//     {
//       type: "list",
//       name: "db",
//       message: "Select a database:",
//       choices: ["mongodb", "postgres", "mysql", "none"],
//     },
//     {
//       type: "confirm",
//       name: "useTS",
//       message: "Use TypeScript?",
//       default: true,
//     },
//   ]);

//   const ext = useTS ? "ts" : "js";
//   const projectPath = path.join(CURR_DIR, projectName);
//   createFolder(projectPath);

//   const dirs = ["src/config", "src/models", "src/controllers", "src/routes"];
//   dirs.forEach((dir) => createFolder(path.join(projectPath, dir)));

//   // index
//   write(
//     path.join(projectPath, `src/index.${ext}`),
//     getIndexTemplate(framework, ext, db)
//   );

//   // db + mvc
//   if (db !== "none") {
//     const dbFile = getDBTemplate(db, ext);
//     write(path.join(projectPath, `src/config/db.${ext}`), dbFile);

//     write(
//       path.join(projectPath, `src/models/user.model.${ext}`),
//       getModel(db, ext)
//     );

//     if (framework === "express") {
//       write(
//         path.join(projectPath, `src/controllers/user.controller.${ext}`),
//         getController(ext)
//       );
//       write(
//         path.join(projectPath, `src/routes/user.route.${ext}`),
//         getRoute(ext)
//       );
//     }
//   }

//   // env
//   write(
//     path.join(projectPath, `.env`),
//     `PORT=5000\n${
//       (db === "mongodb" &&
//         `MONGO_URI=mongodb://localhost:27017/${projectName}`) ||
//       (["postgres", "mysql"].includes(db) && "DB_URI=db-url") ||
//       ""
//     }`
//   );

//   // package.json
//   const deps = [...packages[framework]];
//   if (db === "mongodb") deps.push("mongoose");
//   if (["postgres", "mysql"].includes(db)) deps.push(...packages.sequelize);
//   const devDeps = useTS ? packages.dev : [];

//   const pkgJson = {
//     name: projectName,
//     version: "1.0.0",
//     main: `src/index.${ext}`,
//     type: useTS ? undefined : "module",
//     scripts: {
//       dev: useTS
//         ? "ts-node-dev --respawn --transpile-only src/index.ts"
//         : "node --watch src/index.js",
//       start: useTS
//         ? "ts-node-dev --respawn --transpile-only src/index.ts"
//         : "node src/index.js",
//     },
//     dependencies: {},
//     devDependencies: {},
//   };

//   write(
//     path.join(projectPath, "package.json"),
//     JSON.stringify(pkgJson, null, 2)
//   );

//   // misc
//   write(
//     path.join(projectPath, ".gitignore"),
//     "node_modules\n.env\n.env.local\ndist\n"
//   );
//   write(
//     path.join(projectPath, "README.md"),
//     `# ${projectName}\nGenerated with Create Node Backend CLI`
//   );

//   if (useTS) {
//     write(
//       path.join(projectPath, "tsconfig.json"),
//       JSON.stringify(
//         {
//           compilerOptions: {
//             target: "ES2020",
//             module: "commonjs",
//             outDir: "dist",
//             rootDir: "src",
//             strict: true,
//             esModuleInterop: true,
//             skipLibCheck: true,
//           },
//           include: ["src"],
//           exclude: ["node_modules", "dist"],
//         },
//         null,
//         2
//       )
//     );
//   }

//   console.log(chalk.green("\n📦 Installing dependencies...\n"));
//   execSync(`cd ${projectPath} && npm install ${deps.join(" ")}`, {
//     stdio: "inherit",
//   });
//   if (devDeps.length) {
//     execSync(`cd ${projectPath} && npm install -D ${devDeps.join(" ")}`, {
//       stdio: "inherit",
//     });
//   }

//   console.log(chalk.green(`\n✅ Project ${projectName} is ready!\n`));
//   console.log(chalk.yellow(`\n👉 cd ${projectName} && npm run dev\n`));
// };

// main();
