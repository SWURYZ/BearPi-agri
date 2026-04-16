#include <stdbool.h>
#include "rtdText.h"
#include "rtdUri.h"
#include "ndef.h"
#include "nfc.h"

bool storeUrihttp(RecordPosEnu position, uint8_t *http){

    NDEFDataStr data;


    prepareUrihttp(&data, position, http);
    return   NT3HwriteRecord( &data );
}



bool storeText(RecordPosEnu position, uint8_t *text){
    NDEFDataStr data;


    prepareText(&data, position, text);
    return NT3HwriteRecord( &data );
}
