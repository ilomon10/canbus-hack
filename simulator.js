const can = require("socketcan");

const obdData = require("./obd_pids.json");

const reqId = 0x7df;
const resId = 0x7e8;

const channel = can.createRawChannel("can0", true);
channel.start();

const pids = [...obdData.map((v) => ({
  id: v["PID (dec)"],
  hex_id: v["PID (dec)"],
  name: v["Name (short)"],
  bitStart: v["Bit start"] / 8,
  bitLength: v["Bit length"] / 8,
  raw: v,
  scanned: false,
  available: false
}))];

const listen = (m) => {
  if (m.id == reqId) {
    const reqPID = m.data[2];
    const obd = pids.find((obd) => {
      return obd.hex_id == reqPID;
    })
    const dec = parseInt(Math.random() * (obd.raw.Max - obd.raw.Min));
    let value = (dec - obd.raw.Min) / obd.raw.Scale;
    value = value.toString(16);

    const buff_val = Buffer.from(value, 'hex');
    const data = Buffer.alloc(8);
    data[0] = 0x02;
    data[1] = 0x01;
    data[2] = reqPID;
    buff_val.copy(data, 3);
    console.log(obd.name, `0x${reqPID.toString(16).padStart(2, '0')}`, dec, data);
    channel.send({
      id: resId,
      ext: false,
      rtr: false,
      data: data,
    })
    // console.log("")
  }
}

channel.addListener("onMessage", listen);