(function(root){
"use strict";
root.BMP_ADSONBREAD_TEST_SDK=Object.freeze({
 install({fill=true}={}){root.BMP_ADSONBREAD_SDK={async renderCard({container}={}){if(!fill||!container)return {rendered:false,reason:"no_fill"};const box=document.createElement("div");box.className="sponsorNetworkMock";box.textContent="DEMO NETWORK AD — BMP Terbuka";container.textContent="";container.append(box);return {rendered:true};}};return root.BMP_ADSONBREAD_SDK;},
 uninstall(){delete root.BMP_ADSONBREAD_SDK;}
});
})(typeof self!=="undefined"?self:globalThis);
