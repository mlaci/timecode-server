const fetch = require('node-fetch')
const {Transform} = require('stream')
const mpeg = require("./mpeg-audio.js")
const crypto = require('crypto')
const express = require('express')
const app = express()
app.set('port', (process.env.PORT || 5000))

app.get('/', function (req, res) {
  res.header('Access-Control-Allow-Origin', "*" )
  res.type('json')
  res.status(200).send(mpegData)
})

app.get('/keepalive', function (req, res) {
  res.header('Access-Control-Allow-Origin', "*" )
  res.status(200).send()
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'))
})

const url = process.env.STREAM_URL

var mpegInfo = {}

var mpegData = {}
mpegData.init = () => {
  mpegData.startDate = undefined
  mpegData.count = 0,
  mpegData.hashes =  undefined, 
  mpegData.maxSize = 500,
  mpegData.firstFrame = false
}

class TimeoutTest extends Transform {
  constructor(){
    var timeoutId
    var timeout = () => {
      this.destroy(new Error("timeout"))
    }
    super({
      transform(chunk, encoding, callback){
        clearTimeout(timeoutId)
        timeoutId = setTimeout(timeout, 5000)
        this.push(chunk)
        callback()
      }
    })
  }
}

class Mp3Blocks extends Transform {
  constructor(){
    var buffer = new Uint8Array(0)
    var beforeFirst = true
    super({
      transform(chunk, encoding, callback){
        var oldBuffer = buffer
        buffer = new Uint8Array(oldBuffer.length + chunk.length)
        buffer.set(oldBuffer)
        buffer.set(chunk, oldBuffer.length)
  
        var offset
        if(beforeFirst){
          buffer.some((element, index)=>{
            if(mpeg.test(buffer, index)){
              var {version, layer, frame_length, padding} = mpeg.parse(buffer, index)
              if(version == "1" && layer == "III"){
                offset = index
                mpegInfo.frameLength = frame_length - padding
                return true
              }
            }
          })
        }
        else{
          offset = 0
        }
    
        if(offset !== undefined){
          beforeFirst = false
    
          var frame_length = mpeg.parse(buffer, offset).frame_length
          while(offset + frame_length <= buffer.length){
            this.push(buffer.slice(offset, offset + frame_length))
            offset = offset + frame_length
            if(offset + 4 <= buffer.length){
              frame_length = mpeg.parse(buffer, offset).frame_length
            }
            else{
              frame_length = 4
            }
          }
  
          oldBuffer = buffer
          buffer = new Uint8Array(oldBuffer.length - offset)
          buffer.set(oldBuffer.subarray(offset, oldBuffer.length))
        }
        callback()
      }
    })
  }
}

function captureTimecode(url){
  return fetch(url).then(res => {
    return new Promise((resolve, reject) => {
      if(res.status<200 || res.status>299){
        reject(res.statusText)
      }
      else{
        res.body
        .pipe(new TimeoutTest)
        .on("error", reject)
        .pipe(new Mp3Blocks)
        .on("data", chunk => {
          mpegData.startDate = mpegData.startDate || Math.floor(Date.now()/1000)*1000
          mpegData.count++
          mpegData.hashes = mpegData.hashes || []
            if(mpegData.hashes.length>=mpegData.maxSize){
              mpegData.hashes.shift()
            }
            mpegData.hashes.push([crypto.createHash('sha256').update(chunk).digest('hex').slice(0,10), mpegData.count-1])
        })
        .on("end", reject)
      }
    })
  })
}

function startCapture(){
  mpegData.init()
  timecodeStream = captureTimecode(url)
  .catch(err => { 
    console.log(err)
    setTimeout(startCapture, 5000)
  })
}

startCapture()