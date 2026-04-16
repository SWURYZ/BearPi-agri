#ifndef  NFCFORUM_H_
#define  NFCFORUM_H_

#include <stdbool.h>

#include "rtdTypes.h"
#include "NT3H.h"

#define NDEF_START_BYTE 0x03
#define NDEF_END_BYTE 	0xFE

#define NTAG_ERASED 	0xD0

typedef struct {
	uint8_t startByte;
	uint8_t payloadLength;
}NDEFHeaderStr;

#define BIT_MB (1<<7)
#define BIT_ME (1<<6)
#define BIT_CF (1<<5)
#define BIT_SR (1<<4)
#define BIT_IL (1<<3)
#define BIT_TNF (1<<0)
#define MASK_MB  0x80
#define MASK_ME  0x40
#define MASK_CF  0x20
#define MASK_SR  0x10
#define MASK_IL  0x08
#define MASK_TNF 0x07



typedef struct {
	uint8_t     header;
	uint8_t		typeLength;
	uint8_t		payloadLength;
	RTDTypeStr type;
}NDEFRecordStr;

uint8_t composeRtdText(const NDEFDataStr *ndef,  NDEFRecordStr *ndefRecord, uint8_t *I2CMsg);
uint8_t composeRtdUri(const NDEFDataStr *ndef,  NDEFRecordStr *ndefRecord, uint8_t *I2CMsg);

void composeNDEFMBME(bool isFirstRecord, bool isLastRecord, NDEFRecordStr *ndefRecord);

#endif /* NFCFORUM.H_H_ */
