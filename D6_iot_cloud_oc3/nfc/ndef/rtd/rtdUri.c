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

    uri.type = httpWWW;
    data->specificRtdData = &uri;
}
