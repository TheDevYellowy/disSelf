import axios from "https://deno.land/x/redaxios@0.5.1/mod.ts";

export class CaptchaSolver {
  service: string;
  solver: Function | undefined;
  defaultCaptchaSolver: Function;
  key: null | string;
  solve!: Function;

  constructor(service: string, key: string, defaultCaptchaSolver: Function) {
    this.service = "custom";
    this.solver = undefined;
    this.defaultCaptchaSolver = defaultCaptchaSolver;
    this.key = null;
    this._setup(service, key);
  }

  _setup(service: string, key: string) {
    switch (service) {
      case "capmonster": {
        if (!key || typeof key !== "string") {
          throw new Error("Capmonster key is not provided");
        }
        this.service = "capmonster";
        this.key = key;
        this.solve = (captchaData: any, userAgent: string) => {
          // deno-lint-ignore no-async-promise-executor
          new Promise(async (resolve, reject) => {
            try {
              const createTaskResponse = await axios.post(
                "https://api.capmonster.cloud/createTask",
                {
                  clientKey: this.key,
                  task: {
                    type: "HCaptchaTask",
                    websiteURL: "https://discord.com/channels/@me",
                    websiteKey: captchaData.captcha_sitekey,
                    data: captchaData.captcha_rqdata,
                    isInvisible: !!captchaData.captcha_rqdata,
                    userAgent: userAgent,
                  },
                },
                {
                  headers: {
                    "Content-Type": "application/json",
                    "user-agent": userAgent,
                  },
                },
              );
              const taskId = createTaskResponse.data.taskId;
              let getResults: any = { status: "processing" };
              while (getResults.status == "processing") {
                const getResultsResponse = await axios.post(
                  "https://api.capmonster.cloud/getTaskResult",
                  {
                    clientKey: this.key,
                    taskId,
                  },
                );
                getResults = getResultsResponse.data;
                await new Promise((resolve_) => setTimeout(resolve_, 1500));
              }
              const solution = getResults.solution.gRecaptchaResponse;
              return resolve(await solution);
            } catch (error) {
              reject(
                new Error(
                  `Capmonser errro: ${error.message}`,
                  error?.response?.data,
                ),
              );
            }
            return true;
          });
        };
        break;
      }
      default:
        this.solve = this.defaultCaptchaSolver;
    }
  }
}
