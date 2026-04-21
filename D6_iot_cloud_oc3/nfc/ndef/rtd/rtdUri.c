#include "rtdUri.h"
#include <string.h>
#include "rtdTypes.h"


    RTDUriTypeStr uri;
    
uint8_t addRtdUriRecord(const NDEFDataStr *ndef, RTDUriTypeStr *uriType) {


    uriType->type=((RTDUriTypeStr*) ndef->specificRtdData)->type;

    return 1;
}

void prepareUrihttp(NDEFDataStr *data, RecordPosEnu position, uint8_t *text) {
    data->ndefPosition = position;
    data->rtdType = RTD_URI;
    data->rtdPayload = text;
    data->rtdPayloadlength = strlen((const char *)text);;

    uri.type = http;   // 0x03 http://  （原为 httpWWW=0x01 会前置 http://www.）
    data->specificRtdData = &uri;
}
