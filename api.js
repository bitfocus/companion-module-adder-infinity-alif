const https = require('https');
const { InstanceStatus } = require('@companion-module/base')
const net = require('net');
const { error } = require('console');


function checkReceiver(self, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    const onError = () => {
      socket.destroy();
      reject(new Error('Host not reachable'));
    };

    socket.setTimeout(timeout);
    socket.once('error', onError);
    socket.once('timeout', onError);

    socket.connect(443, self.config.host, () => {
      socket.end();
      resolve(true);  // port is open and reachable
    });
  });
}
async function getPresets(self, userId = 1, retry = 2) {
    try {
        let url = `/api/presets`;
        let result = await makeRequest(self, url, "GET")

        if (result.code != 200){
            self.log("warn", "Could not connect to Receiver. Please check your IP address.");
            return [{id: "None", label: "None"}];
        }
        let data = result.body;
        
        if(Array.isArray(data) && data.length === 0){
            self.log("warn", "No transmitters discovered.");
            return [{id: "None", label: "None"}];
        }
        
        let presets = data
            .map(element => ({ id: element.presetId, label: element.name }))
        
            presets.push({id: "None", label: "None"});
        return presets;

    } catch (error) {
        self.log("error", error.message);
        return -1;
    }
}

async function getSelectedPreset(self, retry = 2){
    try {
        let url = `/api/presets/selected`;
        let result = await makeRequest(self, url, "GET")

        if (result.code != 200){
            self.log("warn", "Could not connect to Receiver. Please check your IP address.");
            return -1;
        }

        let data = result.body;
        
        let preset = data.presetId;
        return preset;

    } catch (error) {
        self.log("error", error.message);
        return -1;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectPreset(self, preset, btn, mode = "shared", retry=2){
    try {
        if (!self.config.token && retry > 0){
            await authenticate(self);
            return await connectPreset(self, preset, mode, retry-=1);
        }
        if (retry <= 0){
            self.log("error", "Could not connect to preset");
            return;
        }
        

        let etagResult = await makeRequest(self, "/api/presets/selected", "GET", {}, {"Connection": "Close"});
        let etag =''

        if(etagResult.code===200){
           etag=etagResult.headers.etag;
            let data = etagResult.body;
            let currentPreset = data.presetId;
            if (currentPreset === preset){
                self.log("info", "Already connected to preset.")
                return true;
            }
       }else{
            self.log("error", "unable to get eTag information");
       }
       //await delay(5000);
       await authenticate(self);

       let switchResult = await makeRequest(self, "/api/presets/selected", "PATCH", {presetId: preset, accessMode: mode}, {"Authorization": self.config.token, "If-Match": etag});

       switch(switchResult.code){
        case 204:
            self.log("info", `204: Preset changed from ${etagResult.body.presetId} to ${preset}`);
            return true
            break;
        case 400:
            self.log("error", "400: Invalid API Schema.");
            return false
            break;
        case 401:
            self.log("error", "401: Incorrect Token")
            await authenticate(self);
            return await connectPreset(self,preset,mode,retry-=1);
        case 404:
            self.log("error", "404: Not Found");
            return false
            break;
        case 412:
            self.log("error", "412: Invalid eTag.");
            return false
            break;
        case 500:
            self.log("error", "500: Internal Server Error. Unsupported View Mode");
            return false
            break;
        default:
            self.log("error", "Uknown Error");
            return false
            return;
       }

    }catch (error){
        self.log("error", error.message);
        if(retry > 0){
            self.presetStatus[preset] = "connecting"
            self.checkFeedbacks("presetStatus", "presetStatusBool", "videoStatusBool");
            await sleep(3000);

            return await connectPreset(self, preset, btn, mode, retry-=1);
        }
        self.log("error", "Failed to change preset, please check your connection");
        return false
    }
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authenticate(self) {
    try {
        let auth = await makeRequest(self, "/api/users/login/1", "POST", {'password': self.config.password, 'isAdmin':true})
        if (!auth.code){
            self.log("error", "Did not get a response from Receiver");
            return;
        }
        switch(auth.code){
            case 200:
                self.config.token = `Bearer ${auth.body.authToken}`;
                self.saveConfig(self.config);
                break;
            case 400:
                self.log("error", "400: Invalid API Schema for logging in.");
                break;
            case 401:
                self.log("error", "401: Incorrect password. Please confirm your configuration.")
            case 403:
                self.log("error", "403: User is not an admin.");
                break;
            case 404:
                self.log("error", "404: User not Found");
                break;
            case 500:
                self.log("error", "500: Internal Server Error");
                break;
            default:
                self.log("error", "Uknown Error");

        }

    } catch (error) {
        self.log("error", `Authentication Error: ${error.message}`);
    }
}

async function makeRequest(self, url, method, payload = {}, extraHeaders = {}) {
    try {
        if (!self.connected){
            self.connected = await self.checkConnection();
        }
        let headers = { "Content-Type": "application/json" };
        if (extraHeaders) {
            headers = { ...headers, ...extraHeaders };
        }

        const options = {
            method: method,
            hostname: self.config.host,
            path: url,
            rejectUnauthorized: false,
            headers: headers,
            agent: new https.Agent({keepAlive: false})
        };

        return new Promise((resolve, reject) => {
            if (!self.connected){
                self.log("warn", "Receiver is not available. Please check connection.");
                reject(new Error("Receiver not available. Cancelling request."));            
            }
            let chunks = [];
            const req = https.request(options, (res) => {
                res.on("data", (chunk) => {
                    chunks.push(chunk);
                });

                res.on("end", async () => {
                    const body = Buffer.concat(chunks);

                    if (res.statusCode === 200) {
                        const bodyParse = JSON.parse(body.toString());
                        const result = {
                            code: res.statusCode,
                            headers: res.headers,
                            body: bodyParse,
                        };
                        resolve(result);
                    } else {
                        resolve({ code: res.statusCode });
                    }
                });
            });

            // let timeout = 1000;
            // req.setTimeout(timeout, () => {
            //     req.destroy();
            //     if (self.currentStatus != InstanceStatus.ConnectionFailure){
            //         self.currentStatus = InstanceStatus.ConnectionFailure;
            //         self.updateStatus(InstanceStatus.ConnectionFailure, "API Request Failed, Check Connection.")
            //     }
            //     reject(new Error(`Request timed out. Please check the target IP.`));
            // });

            req.on("error", (error) => {
                self.log("error", `Request error: ${error.message}`);
                reject(error);
            });

            // Write payload if present
            if (payload) {
                req.write(JSON.stringify(payload));
            }

            req.end();
        });
    } catch (error) {
        reject(error)
        self.log("error", `Error in request: ${error.message}`);
    }
}

module.exports = { getPresets, connectPreset, authenticate, getSelectedPreset, checkReceiver }