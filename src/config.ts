import { config } from "dotenv"
import { cwd } from "process"
import { join } from "path"
import { pathToFileURL } from "url"


const conf = config()

if (conf.error) {
    throw conf.error
}

if (!conf.parsed) {
    throw Error("[environment]: .env file not found.")
}

if (!conf.parsed["NODE_ENV"] || !["dev", "test", "production"].includes(conf.parsed["NODE_ENV"])) {
    console.log("[env] info: unrecognised running env, setting it to 'dev'")
    conf.parsed["NODE_ENV"] = "dev"
}

let _config
try {
    const configPath = pathToFileURL(join(cwd(), "src", "config", "http.js")).href
    _config = (await import(configPath)).default
} catch (e: any) {
    console.log(`[http-server] config: config file not found, applying default config.`)
    _config = {
        port: 3000,
        globalMiddlewares: [],
        form: {
            formOptions: {
                encoding: "utf-8",
                keepExtensions: true,
                uploadDir: "tmp/uploads",
            }
        },
        https: undefined,
    }
}

export const CONFIG = { ..._config, NODE_ENV: conf.parsed.NODE_ENV }
