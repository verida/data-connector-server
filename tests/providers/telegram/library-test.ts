import CONFIG from "../../../src/config"
import { TelegramApi } from "../../../src/providers/telegram/api";

const assert = require("assert");

describe(`Can load the TG library`, function () {
  this.timeout(100000);


  describe(`Telegram library test`, () => {

    it(`Can open the library`, async () => {
        const api = new TelegramApi("test")
        console.log('getting client')
        const client = await api.getClient()
        console.log('have client')
    })
      
  });

});
