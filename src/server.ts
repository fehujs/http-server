import formidable from "formidable"

import { type Controllers, setupContainer } from "@fehujs/ioc"

import { ErrorsController } from "./helpers/errors-controller"
import { MiddlewareError, Middleware } from "./lib/middleware"
import { Request } from "./lib/request"
import { Response } from "./lib/response"
import type { HttpContext, RequestListenerOptions, Route, Routes } from "./types"
import { extractRouteParams, patternToRegex } from "./router"


export function getEndpoint(routes: Routes, method: string | undefined, request: Request) {
    const url = request.url(true) as URL
    let path: string

    if (!method) method = 'GET'
    if (url.pathname !== "/" && url.pathname[url.pathname.length - 1] === "/") path = url.pathname.slice(0, -1)
    else path = url.pathname

    for (const key in routes) {
        const pattern = key.slice(method.length + 1)
        const regex = routes[key]._regex!  // exists because they were set before server launch
        const match = path.match(regex)

        if (key.startsWith(method) && match) {
            request._setParams(extractRouteParams(match, pattern))
            return `${method}:${pattern}`
        }
    }

    return `${method}:${path}`
}

export async function requestListener(options: RequestListenerOptions) {
    const form = {
        incomingForm: formidable(options.form.formOptions ?? {}),
        errorHandler: options.form.errorHandler
    }

    let httpContext: HttpContext = {
        req: options.req,
        request: await Request.init(form, options.req),
        response: new Response()
    }

    let error: Error | undefined

    /** if the url as a '/' at the end, remove it (to avoid 404 for defined routes) */
    const endpoint = getEndpoint(options.routes, options.req.method, httpContext.request)

    if (httpContext.request.formStatus === "ok") {
        try {
            if(options.routes[endpoint] !== undefined) {
                const route = options.routes[endpoint]

                /** response context is by default on "middleware" */
                if (route.middlewares && route.middlewares.length > 0) {
                    httpContext = await runMiddlewares(httpContext, route)
                }

                httpContext.response._changeContext("route")

                if (httpContext.response.shouldRunRouteCallback()) {
                    httpContext.response = await runView(httpContext, options.controllers, route)
                }
            } else {  // HTTP 404
                httpContext.response = await runController(httpContext, options.controllers, ["ErrorsController", "notFound"])
            }
        } catch (e: any) {  // HTTP 500
            httpContext.response = await runController(
                httpContext,
                options.controllers,
                ["ErrorsController", "serverError"],
                { name: e.name, message: e.message, stack: e.stack }
            )
            error = e
        }
    } else {  // HTTP 400
        httpContext.response = await runController(
            httpContext,
            options.controllers,
            ["ErrorsController", "badRequest"],
            { message: httpContext.request.formStatus }
        )
        error = new Error("badRequest")
    }

    
    console.log(`[${endpoint}] ${httpContext.response.statusCode}`)

    if (error) {
        console.log(`\n\n\t${error.stack}\n\n`)
    }

    options.res.writeHead(httpContext.response.statusCode, httpContext.response.headers)
    options.res.write(httpContext.response.body)

    options.res.end()
}

export async function runController(
    httpContext: HttpContext,
    controllers: Controllers,
    controller: [string, string],
    args?: any
): Promise<Response> {
    return await (controllers[controller[0]] as any)[controller[1]](httpContext, args)
}

export async function runMiddlewares(httpContext: HttpContext, route: Route) {
    try {
        /** runs all middlewares */
        httpContext = await route.middlewares![0].handle(httpContext)
    } catch (e: any) {
        if (e instanceof MiddlewareError) {
            httpContext.response = httpContext.response.setResponse(e.responseData)
        }
    }
    return httpContext
}

export async function runView(httpContext: HttpContext, controllers: Controllers, route: Route): Promise<Response> {
    if (route.controller) {
        return await runController(httpContext, controllers, route.controller)
    } else {
        return await route.callback(httpContext)
    }
}

export async function setupControllers() {
    const controllers = await setupContainer()
    controllers["ErrorsController"] = new ErrorsController()
    return controllers
}

function instanciateGlobalMiddlewareList(globalMiddlewares: (typeof Middleware)[]) {
    let result = []
    for (let i = 0; i < globalMiddlewares.length; i++) {
        result.push(new globalMiddlewares[i]())
    }
    return result
}

export function setupRoutes(routes: Routes, globalMiddlewares: (typeof Middleware)[]) {
    Object.keys(routes).forEach(key => {
        const route = routes[key]
        if (!route._regex) {
            const pattern = '/' + key.split(":/")[1]
            route._regex = patternToRegex(pattern)
        }

        route.middlewares = instanciateGlobalMiddlewareList(globalMiddlewares)
            .concat(route.middlewares ?? [])

        for (let i = 1; i < route.middlewares.length; i++) {
            route.middlewares[i - 1].setNext(route.middlewares[i])
        }
    })
    return routes
}
