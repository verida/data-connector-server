import { Request, Response, NextFunction } from "express";

export default class Controller {
    public static async apiKeySubmit(req: Request, res: Response, next: NextFunction) {
        try {
            const apiKey = req.body.apiKey;

            // @todo Validate API key if any (pending from FireFlies)
           
            // Redirect to the callback endpoint with the apiKey            
            res.status(200).send({
                redirect: `/callback/fireflies?apiKey=${encodeURIComponent(apiKey)}`
            });
            
        } catch (error) {
            res.status(400).send({
                error: error.message
            });
        }
    }
}
