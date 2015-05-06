serverless-webrtc with minimum sdp
==================================

This project is a clone of https://github.com/cjb/serverless-webrtc

and uses inspirations and code from https://webrtchacks.com/the-minimum-viable-sdp/ 
and https://github.com/fippo/minimal-webrtc

The site works exactly like the serverless-webrtc project, but the sdp is stripped down to the bare minimum and is encoded to be  shorter.

Format for sdp:

The sdp is compressed into a single csv string. For this application, only STUN is used.

Elements in csv:

0) Either O or A, for Offer and Answer
1) ice-ufrag
2) ice-pwd
3) fingerprint base64 encoded 
4) global IP and Port (seperated by ':') from 'typ srflx' candidate. The IP is hex encoded and the port is base32 encoded
5) local IP and Port (seperated by ':') from 'typ srflx' candidate

We know we want to make a simple data connection. This 116 length string has all the info we need.

After the initial connection has been made, normal SDP's can be sent over the WebRTC connection to make video and voice calls in the future.



