// Core 8A TEST-ONLY native W3C Firefox startup recovery policy.
// A hung /session call is NOT evidence of a real admitted game participant.
// On isolated Linux runners only, permit ONE fresh geckodriver process group
// on a different local port after fully killing the timed-out original.
export function nativeDriverPortForAttempt(browser,attempt){
  if(!browser||!Number.isSafeInteger(browser.port)||browser.port<1024
    ||browser.port>65000||![0,1].includes(attempt))
    throw Error("unreviewed real native driver retry port");
  return browser.port+(attempt===1?100:0);
}
export function retryNativeFirefoxSession(error,browser,attempt,platform){
  return platform==="linux"&&browser?.family==="firefox"&&attempt===0
    &&error?.name==="TimeoutError";
}
