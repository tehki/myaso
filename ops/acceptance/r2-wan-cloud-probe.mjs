import dgram from 'node:dgram';
const receiver='168.113.210.63',port=44550;
const token=Buffer.from('MYASO_R2_CLOUD_WAN_REQUEST_20261020_V1');
const acknowledged='MYASO_R2_CLOUD_WAN_READY_V1';
const socket=dgram.createSocket('udp4');
let attempts=0,done=false;
function finish(code,msg){
 if(done)return;
 done=true;
 clearInterval(pump);clearTimeout(expire);
 console.log(msg);
 socket.close();
 process.exitCode=code;
}
socket.on('error',e=>finish(4,'R2_CLOUD_PROBE_ERROR='+e.message));
socket.on('message',(buf,rinfo)=>{
 if(rinfo.address===receiver && rinfo.port===port && buf.toString()===acknowledged){
  finish(0,'R2_CLOUD_PRIVATE_STAGING_READY_ACKED_REMOTE='+rinfo.address+':'+rinfo.port);
 }
});
function send(){attempts++;socket.send(token,port,receiver)}
console.log('R2_CLOUD_WAN_PUBLIC_DISCOVERY_BEGIN');
send();
const pump=setInterval(send,900);
const expire=setTimeout(()=>finish(2,'R2_CLOUD_EXTERNAL_WAN_PROBE_TIMEOUT_AFTER_ATTEMPTS='+attempts),185000);
process.on('SIGTERM',()=>finish(130,'CANCELLED'));
