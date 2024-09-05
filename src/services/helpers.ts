import { KeywordSearchTimeframe } from "../helpers/interfaces"

const dayInSeconds = 60*60*24

const TIMEFRAME_SECONDS: Record<string, number | undefined> = {
    [KeywordSearchTimeframe.DAY]: dayInSeconds,
    [KeywordSearchTimeframe.WEEK]: dayInSeconds * 7,
    [KeywordSearchTimeframe.MONTH]: dayInSeconds * 30,
    [KeywordSearchTimeframe.QUARTER]: dayInSeconds * 90,
    [KeywordSearchTimeframe.HALF_YEAR]: dayInSeconds * 180,
    [KeywordSearchTimeframe.FULL_YEAR]: dayInSeconds * 365,
    [KeywordSearchTimeframe.ALL]: undefined
}

export class Helpers {

    public static keywordTimeframeToDate(timeframe: KeywordSearchTimeframe) {
        const maxAgeSeconds = TIMEFRAME_SECONDS[timeframe]
        if (!maxAgeSeconds) {
            return new Date("1900-01-01")
        }

        return new Date((new Date()).getTime() - maxAgeSeconds * 1000);
    }

}