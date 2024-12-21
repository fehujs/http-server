import { File, Options } from "formidable"
import IncomingForm from "formidable/Formidable"
import { IncomingMessage, ServerResponse } from "http"

import { Controllers } from "@fehujs/ioc"

import { Middleware } from "./lib/middleware"
import { Request } from "./lib/request"
import { Response } from "./lib/response"


export type Cookie = {
    name: string
    value: string
    domain?: string
    expires?: string
    httpOnly?: boolean
    maxAge?: number
    partitioned?: boolean
    path?: string
    secure?: boolean
    sameSite?: "Strict" | "Lax" | "None"
}

export interface ExtractBodyInterface {
    fields: RequestBody
    files: RequestFiles
}

export type Form = 
    | { formOptions?: never, incomingForm: IncomingForm, errorHandler?: (err: any) => string }
    | { formOptions: Options, incomingForm?: never, errorHandler?: (err: any) => string }

export type Headers = Record<string, string>

export type HttpContext = {
    req?: IncomingMessage
    request: Request
    response: Response
}

export type HttpsCredentials = {
    key: string
    cert: string
}


export type RequestBody = Record<string, string>

export type RequestFiles = Record<string, File[] | undefined>

export type RequestListenerOptions = {
    req: IncomingMessage
    res: ServerResponse
    routes: Routes
    controllers: Controllers
    form: Form
}

export type ResponseBody = string | Buffer

export type ResponseContext = 'middleware' | 'route'

type RouteOptional = {
    description?: string
    middlewares?: Middleware[]

    /** this will be set by the server at launch */
    _regex?: RegExp
}

/**
 * You can set a callback or put a tuple ["YourController", "yourMethod"]
 */
export type Route = 
    | { callback: (httpContext: HttpContext) => Promise<Response>; controller?: never } & RouteOptional
    | { callback?: never; controller: [string, string] } & RouteOptional

export type Routes = Record<string, Route>

export type RouteParams = Record<string, string>
