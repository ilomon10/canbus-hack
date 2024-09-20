const can = require("socketcan");

const obdData = require("./obd_pids.json");

const reqId = 0x7df;
const resId = 0x7e8;

const channel = can.createRawChannel("can0", true);
channel.start();

const pids = [...obdData.map((v) => ({
    id: v["PID (dec)"],
    name: v["Name (short)"],
    bitStart: v["Bit start"] / 8,
    bitLength: v["Bit length"] / 8,
    raw: v,
    scanned: false,
    available: false
}))];

const b_scan = (broadcast_pid) => {
    const pid = parseInt(broadcast_pid, 16);
    const pidx = pids.findIndex((pd) => pd.id == pid);
    if (pidx === -1) return;
    pids[pidx].available = true;
    const p = pids[pidx];
    console.log(`SCAN ${pid.toString(16)}`);
    channel.send({
        id: reqId,
        ext: false,
        rtr: false,
        data: Buffer.from([0x02, 0x01, p.id, 0x00, 0xaa, 0xaa, 0xaa, 0x00])
    });
    const handleMessage = (m) => {
        if (p.scanned) return;
        if (m.id == 0x7E8 && m.data[2] == pid) {
            const byteArray = new Uint8Array(m.data.slice(3, 7));
            const dv = new DataView(byteArray.buffer);
            const dec = dv.getInt32(0, false);
            const bin = dec.toString(2).padStart(32, '0');
            console.log(bin);
            console.log("Available PIDs:");
            bin.split("").forEach((available, idx) => {
                if (available == 0) return;
                const cpi = pids.findIndex(pd => pd.id == pid + idx);
                // console.log(cpi);
                if (cpi === -1) return;

                pids[cpi].available = true;
                const curP = pids[cpi];
                console.log(`+ ${curP.id.toString(16).padStart(3, 0)} ${curP.name}`)
            });
            if (bin[bin.length - 1] > 0) {
                if (pids.findIndex(pd => pd.id == (bin.length + pid)) > -1) {
                    b_scan((bin.length + pid).toString(16))
                } else {
                    run();
                    console.log("Scan COMPLETE!");
                }
            }
            pids[pidx].scanned = true;
        }
        // channel.removeListener("onMessage", handleMessage);
    }
    channel.addListener("onMessage", handleMessage);
}

b_scan(0x00);

function run() {
    const av_pids = pids.filter((p) => p.available);
    av_pids.forEach((p) => {
        // console.log(p);
        channel.addListener("onMessage", (m) => {
            if (!(m.id == resId && p.id === m.data[2])) return;
            const byteArray = m.data.slice(p.bitStart, p.bitStart + p.bitLength);
            const dec = bufferToDecimal(byteArray);
            const bin = dec.toString(2).padStart(32, '0');
            console.log(`${p.id} ${p.name}: ${p.raw.Min + p.raw.Scale * dec} ${p.raw.Unit}`, dec);
            console.log('bitearr: ', byteArray);
        })
    })


    const scan = (pid) => {
        console.log("Send");
        channel.send({
            id: reqId,
            ext: false,
            rtr: false,
            data: Buffer.from([0x02, 0x01, pid, 0x00, 0xaa, 0xaa, 0xaa, 0x00])
        });
    }

    let intervalId = null;

    async function scanPid() {
        for (const pd of av_pids) {
            await sleep(1000);
            scan(pd.id);
        }
    }

    async function init() {	   
      while (true) {
	      scanPid()
      }
    }

    init();
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function bufferToDecimal(buffer) {
    let decimal = 0;
    for (let i = 0; i < buffer.length; i++) {
        decimal = (decimal << 8) | buffer[i];
    }
    return decimal;
}

// channel.stop();
