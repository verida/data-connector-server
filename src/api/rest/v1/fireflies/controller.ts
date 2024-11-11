import { Request, Response, NextFunction } from "express";

export default class Controller {
    public static async apiKeySubmit(req: Request, res: Response, next: NextFunction) {
        try {
            const apiKey = req.body.apiKey;

            // @todo Validate API key if any (pending from FireFlies)
           
            // Redirect to the callback endpoint with the apiKey
            res.redirect(`/callback/fireflies?apiKey=${encodeURIComponent(apiKey)}`);
        } catch (error) {
            next(error); 
        }
    }
}
