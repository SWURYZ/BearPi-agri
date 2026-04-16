#ifndef _NFC_H_
#define _NFC_H_

#include "NT3H.h"

/*
 * The function write in the NT3H a new URI Rtd on the required position
 *
 * param:
 *      position: where add the record
 *      http:     the address to write
 *
 */
bool storeUrihttp(RecordPosEnu position, uint8_t *http);


/*
 * The function write in the NT3H a new Text Rtd on the required position
 *
 * param:
 *      position: where add the record
 *      text:     the text to write
 *
 */
bool storeText(RecordPosEnu position, uint8_t *text);

#endif /* NFC_H_ */
