/* See also:
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
    https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html

    https://webrtc-demos.appspot.com/html/pc1.html
*/

var cfg = {"iceServers":[{"url":"stun:stun.l.google.com:19302"}]},
    con = { 'optional': [{'DtlsSrtpKeyAgreement': true}] };

/* THIS IS ALICE, THE CALLER/SENDER */

var pc1 = new RTCPeerConnection(cfg, con),
    dc1 = null, tn1 = null;

// Since the same JS file contains code for both sides of the connection,
// activedc tracks which of the two possible datachannel variables we're using.
var activedc;

var pc1icedone = false;

$('#showLocalOffer').modal('hide');
$('#getRemoteAnswer').modal('hide');
$('#waitForConnection').modal('hide');
$('#createOrJoin').modal('show');

$('#createBtn').click(function() {
    $('#showLocalOffer').modal('show');
    createLocalOffer();
});

$('#joinBtn').click(function() {
    $('#getRemoteOffer').modal('show');
});

$('#offerSentBtn').click(function() {
    $('#getRemoteAnswer').modal('show');
});

$('#offerRecdBtn').click(function() {
    var offer =  get_expanded_sdp($('#remoteOffer').val());
    var offerDesc = new RTCSessionDescription(offer);
    console.log("Received remote offer", offerDesc);
    writeToChatLog("Received remote offer", "text-success");
    handleOfferFromPC1(offerDesc);
    $('#showLocalAnswer').modal('show');
});

$('#answerSentBtn').click(function() {
    $('#waitForConnection').modal('show');
});

$('#answerRecdBtn').click(function() {
    var answer = get_expanded_sdp($('#remoteAnswer').val());
    var answerDesc = new RTCSessionDescription(answer);
    handleAnswerFromPC2(answerDesc);
    $('#waitForConnection').modal('show');
});

$('#fileBtn').change(function() {
    var file = this.files[0];
    console.log(file);

    sendFile(file);
});

function fileSent(file) {
    console.log(file + " sent");
}

function fileProgress(file) {
    console.log(file + " progress");
}

function sendFile(data) {
    if (data.size) {
        FileSender.send({
          file: data,
          onFileSent: fileSent,
          onFileProgress: fileProgress,
        });
    }
}

function sendMessage() {
    if ($('#messageTextBox').val()) {
        var channel = new RTCMultiSession();
        writeToChatLog($('#messageTextBox').val(), "text-success");
        channel.send({message: $('#messageTextBox').val()});
        $('#messageTextBox').val("");

        // Scroll chat text area to the bottom on new input.
        $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
    }

    return false;
};

function setupDC1() {
    try {
        var fileReceiver1 = new FileReceiver();
        dc1 = pc1.createDataChannel('test', {reliable:true});
        activedc = dc1;
        console.log("Created datachannel (pc1)");
        dc1.onopen = function (e) {
            console.log('data channel connect');
            $('#waitForConnection').modal('hide');
            $('#waitForConnection').remove();
        }
        dc1.onmessage = function (e) {
            console.log("Got message (pc1)", e.data);
            if (e.data.size) {
                fileReceiver1.receive(e.data, {});
            }
            else {
                if (e.data.charCodeAt(0) == 2) {
                   // The first message we get from Firefox (but not Chrome)
                   // is literal ASCII 2 and I don't understand why -- if we
                   // leave it in, JSON.parse() will barf.
                   return;
                }
                console.log(e);
                var data = JSON.parse(e.data);
                if (data.type === 'file') {
                    fileReceiver1.receive(e.data, {});
                }
                else {
                    writeToChatLog(data.message, "text-info");
                    // Scroll chat text area to the bottom on new input.
                    $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
                }
            }
        };
    } catch (e) { console.warn("No data channel (pc1)", e); }
}

function createLocalOffer() {
    setupDC1();
    pc1.createOffer(function (desc) {
        pc1.setLocalDescription(desc, function () {}, function () {});
        console.log("created local offer", desc);
    }, function () {console.warn("Couldn't create offer");});
}

pc1.onicecandidate = function (e) {
    console.log("ICE candidate (pc1)", e);
    if (e.candidate == null) {
        $('#localOffer').html(get_reduced_sdp(pc1.localDescription));
        console.log(pc1.localDescription);
        $('#localOffer').focus();
        $('#localOffer').select();
    }
};

function handleOnconnection() {
    console.log("Datachannel connected");
    writeToChatLog("Datachannel connected", "text-success");
    $('#waitForConnection').modal('hide');
    // If we didn't call remove() here, there would be a race on pc2:
    //   - first onconnection() hides the dialog, then someone clicks
    //     on answerSentBtn which shows it, and it stays shown forever.
    $('#waitForConnection').remove();
    $('#showLocalAnswer').modal('hide');
    $('#messageTextBox').focus();
}

pc1.onconnection = handleOnconnection;

function onsignalingstatechange(state) {
    console.info('signaling state change:', state);
}

function oniceconnectionstatechange(state) {
    console.info('ice connection state change:', state);
}

function onicegatheringstatechange(state) {
    console.info('ice gathering state change:', state);
}

pc1.onsignalingstatechange = onsignalingstatechange;
pc1.oniceconnectionstatechange = oniceconnectionstatechange;
pc1.onicegatheringstatechange = onicegatheringstatechange;

function handleAnswerFromPC2(answerDesc) {
    console.log("Received remote answer: ", answerDesc);
    writeToChatLog("Received remote answer", "text-success");
    pc1.setRemoteDescription(answerDesc);
}

function handleCandidateFromPC2(iceCandidate) {
    pc1.addIceCandidate(iceCandidate);
}


/* THIS IS BOB, THE ANSWERER/RECEIVER */

var pc2 = new RTCPeerConnection(cfg, con),
    dc2 = null;

var pc2icedone = false;

pc2.ondatachannel = function (e) {
    var fileReceiver2 = new FileReceiver();
    var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
    console.log("Received datachannel (pc2)", arguments);
    dc2 = datachannel;
    activedc = dc2;
    dc2.onopen = function (e) {
        console.log('data channel connect');
        $('#waitForConnection').modal('hide');
        $('#waitForConnection').remove();
    }
    dc2.onmessage = function (e) {
        console.log("Got message (pc2)", e.data);
        if (e.data.size) {
            fileReceiver2.receive(e.data, {});
        }
        else {
            var data = JSON.parse(e.data);
            if (data.type === 'file') {
                fileReceiver2.receive(e.data, {});
            }
            else {
                writeToChatLog(data.message, "text-info");
                // Scroll chat text area to the bottom on new input.
                $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
            }
        }
    };
};

function handleOfferFromPC1(offerDesc) {
    pc2.setRemoteDescription(offerDesc);
    pc2.createAnswer(function (answerDesc) {
        writeToChatLog("Created local answer", "text-success");
        console.log("Created local answer: ", answerDesc);
        pc2.setLocalDescription(answerDesc);
    }, function () { console.warn("No create answer"); });
}

pc2.onicecandidate = function (e) {
    console.log("ICE candidate (pc2)", e);
    if (e.candidate == null){
       $('#localAnswer').html(get_reduced_sdp(pc2.localDescription));
       console.log(pc2.localDescription);
       $('#localAnswer').focus();
       $('#localAnswer').select();
    }
};

pc2.onsignalingstatechange = onsignalingstatechange;
pc2.oniceconnectionstatechange = oniceconnectionstatechange;
pc2.onicegatheringstatechange = onicegatheringstatechange;

function handleCandidateFromPC1(iceCandidate) {
    pc2.addIceCandidate(iceCandidate);
}

pc2.onaddstream = function (e) {
    console.log("Got remote stream", e);
    var el = new Audio();
    el.autoplay = true;
    attachMediaStream(el, e.stream);
};

pc2.onconnection = handleOnconnection;

function getTimestamp() {
    var totalSec = new Date().getTime() / 1000;
    var hours = parseInt(totalSec / 3600) % 24;
    var minutes = parseInt(totalSec / 60) % 60;
    var seconds = parseInt(totalSec % 60);

    var result = (hours < 10 ? "0" + hours : hours) + ":" +
                 (minutes < 10 ? "0" + minutes : minutes) + ":" +
                 (seconds  < 10 ? "0" + seconds : seconds);

    return result;
}

function writeToChatLog(message, message_type) {
    document.getElementById('chatlog').innerHTML += '<p class=\"' + message_type + '\">' + "[" + getTimestamp() + "] " + message + '</p>';
}

function get_reduced_sdp(desc){
            var sdp = desc.sdp;
            var lines = sdp.split('\r\n');
            var ice_pwd = "";
            var ice_ufrag = "";
            var ip_s = new Array();
            var finger;
            var type = (desc.type === 'offer' ? 'O' : 'A');
            //console.log(type);
            for(var i = 0; i < lines.length;i++){
                var temp = lines[i].split(':')
                if(temp[0] == 'a=ice-pwd'){
                    ice_pwd = temp[1];
                    //console.log('ice_pwd '+ice_pwd);
                }
                else if(temp[0] == 'a=ice-ufrag'){
                    ice_ufrag = temp[1];
                    //console.log('ice_ufrag: '+ice_ufrag);
                }
                else if(temp[0] == 'a=candidate'){
                    if(temp[1].indexOf('raddr') !== -1){
                        var temp_split = temp[1].split(' ');
                        for(var j = 0; j< temp_split.length; j++){
                            if(temp_split[j].indexOf('.') !== -1){
                                if(temp_split[j+1] == 'rport'){
                                    //console.log(temp_split[j] + " " + temp_split[j+2]);
                                    var t_arr = new Array([encode_ip(temp_split[j]), base32encode(temp_split[j+2])]);
                                    ip_s.push(encode_ip(temp_split[j])+':'+ base32encode(temp_split[j+2]));
                                }
                                else{
                                    var t_arr = new Array([encode_ip(temp_split[j]), base32encode(temp_split[j+1])]);
                                    ip_s.push(encode_ip(temp_split[j])+':'+base32encode(temp_split[j+1]));
                                    //console.log(temp_split[j] + " " + temp_split[j+1]);
                                }
                            }
                        }
                        //console.log(temp[1]);
                    }
                    // ice_ufrag = temp[1];
                    // console.log('ice_ufrag: '+ice_ufrag);
                }
                else if(temp[0] =='a=fingerprint'){
                    var f = lines[i].split(' ')[1].split(':');
                    var hex = f.map(function(h){
                        return parseInt(h,16);
                    });
                    //console.log('hex: '+hex);
                    finger = btoa(String.fromCharCode.apply(String, hex));
                    console.log(finger);

                    // var new_finger = atob(finger).split('').map(function (c) { var d = c.charCodeAt(0); var e = c.charCodeAt(0).toString(16).toUpperCase(); if (d < 16) e = '0' + e; return e; }).join(':');
                    // console.log("new_finger " + new_finger);
                    //console.log(f);

                    //test

                }
            }
            var resp = type+','+ice_ufrag+','+ice_pwd+','+finger;
            for(var k = 0; k< ip_s.length;k++){
                resp += ','+ip_s[k];
            }
            //console.log("length: "+ resp.length);

            console.log(resp);
            console.log('Length: '+ resp.length);
            //console.log(lines);
            //console.log(ip_s);
            return resp;
        }

        function get_expanded_sdp(red){
            var things = red.split(',');
            console.log("EXPANDED:")
            //console.log(things);
            var type = (things[0] === 'O' ? 'offer' :'answer');
            var ice_ufrag = things[1];
            var ice_pwd = things[2];
            var finger = atob(things[3]).split('').map(function (c) { var d = c.charCodeAt(0); var e = c.charCodeAt(0).toString(16).toUpperCase(); if (d < 16) e = '0' + e; return e; }).join(':');
            console.log('type: ' +type);
            console.log('ice_ufrag: ' +ice_ufrag);
            console.log('ice_pwd: ' +ice_pwd);
            console.log('fingerprint: ' +finger);
            var ip1 = things[4].split(":");
            var glob_ip = decode_ip(ip1[0]);
            var glob_port = base32decode(ip1[1]);

            console.log('glob_ip: ' +glob_ip);
            console.log('glob_port: ' +glob_port);

            var ip2 = things[5].split(":");
            var loc_ip = decode_ip(ip2[0]);
            var loc_port = base32decode(ip2[1]);

            console.log('loc_ip: ' +loc_ip);
            console.log('loc_port: ' +loc_port);

            var sdp = ['v=0',
                'o=- 5498186869896684180 2 IN IP4 127.0.0.1',
                's=-', 't=0 0', 'a=msid-semantic: WMS',
                'm=application 9 DTLS/SCTP 5000',
                'c=IN IP4 '+glob_ip,
                'a=mid:data',
                'a=sctpmap:5000 webrtc-datachannel 1024'
            ];

            if (type === 'answer') {
                sdp.push('a=setup:active');
            } else {
                sdp.push('a=setup:actpass');
            }

            sdp.push('a=ice-ufrag:' + ice_ufrag);
            sdp.push('a=ice-pwd:' + ice_pwd);
            sdp.push('a=fingerprint:sha-256 ' + finger);

            sdp.push('a=candidate:328666875 1 udp 2122260223 '+loc_ip+' '+loc_port+' typ host generation 0');
            sdp.push('a=candidate:1561653771 1 tcp 1518280447 '+loc_ip+' 0 typ host tcptype active generation 0');
            sdp.push('a=candidate:3133702446 1 udp 1686052607 '+glob_ip+' '+glob_port+' typ srflx raddr '+loc_ip+' rport '+loc_port+' generation 0');
            //console.log(sdp);
            return {type: type, sdp: sdp.join('\r\n') + '\r\n'};

        }
        function d2h(d){
            var temp = d.toString(16);
            if(d <16){
                return '0'+temp;
            }
            else{
                return temp;
            }
        }
        function encode_ip(ip){
            var temp = ip.split('.');
            var ans = "";
            for(var i = 0; i < temp.length;i++){
                ans = ans + d2h(parseInt(temp[i]));
            }
            return ans;
        }
        function decode_ip(ip){
            var ret = new Array();
            for(var i = 0; i < ip.length/2;i++){
                var temp = ip.substring(i*2, (i+1)*2);
                ret.push(parseInt(temp, 16));
            }
            return ret.join('.');
        }
        function base32encode(num){
            return parseInt(num).toString(32);
        }
        function base32decode(num){
            return parseInt(num,32);
        }
