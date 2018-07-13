const regexp = /11111111111(00|10|11)(01|10|11)(.)((?!0000)(?!1111)....)(00|01|10)(.)(.)(..)(..)(.)(.)(00|10|11)/,
toBitStr = header => Array.from(header).map(n=>n.toString(2)).map(s=>s.padStart(8,'0')).join(''),
test = (chunk,offset = 0) => regexp.test(toBitStr(chunk.slice(offset, offset+4))),
a   = ['free',32,64,96,128,160,192,224,256,288,320,352,384,416,448], b = ['free',32,48,56,64,80,96,112,128,160,192,224,256,320,384],
c   = ['free',32,40,48, 56, 64, 80, 96,112,128,160,192,224,256,320], d = ['free',32,48,56,64,80,96,112,128,144,160,176,192,224,256],
e   = ['free', 8,16,24, 32, 40, 48, 56, 64, 80, 96,112,128,144,160], slot = {'11':4,'10':1,'01':1}, x = 384, y = 1152, z = 576,
brt = {'11':{'11':a,'10':b,'01':c},'10':{'11':d,'10':e,'01':e},'00':{'11':d,'10':e,'01':e}},
spf = {'11':{'11':x,'10':y,'01':y},'10':{'11':x,'10':y,'01':z},'00':{'11':x,'10':y,'01':z}},
srt = {'11':[44100,48000,32000],   '10':[22050,24000,16000],   '00':[11025,12000,8000]},
parse = (chunk,offset = 0) => {
  const [_,vrs,lyr,ptb,bri,sri,pdb,pvb,chm,mde,crb,orb,emp] = regexp.exec(toBitStr(chunk.slice(offset, offset+4))),
  res = {
    bitrate:    brt[vrs][lyr][Number('0b'+bri)]*1000, sampling_rate:     srt[vrs][Number('0b'+sri)],
    version:    {'11':"1",'10':"2",'00':"2.5"}[vrs],  emphasis:          {'00':"none",'10':"50/15 ms",'11':" CCIT J.17"}[emp],
    layer:      {'11':"I",'10':"II",'01':"III"}[lyr], channel_mode:      ["stereo","joint-stereo","dual","mono"][Number('0b'+chm)],
    protection:  !Number(ptb),                        channel_mode_ext:  Number('0b'+mde),
    padding:    !!Number(pdb),                        channel_count:     chm == '11' && 1 || 2,
    private:    !!Number(pvb),                        samples_per_frame: spf[vrs][lyr],
    copyright:  !!Number(crb),                        bytes_in_slot:     slot[lyr],
    original:    !Number(orb)
  }
  res.duration = res.samples_per_frame/res.sampling_rate
  res.frame_length = Math.floor(res.duration * res.bitrate/8 + res.padding) * res.bytes_in_slot
  return res
}
Object.assign(exports, {test, parse})