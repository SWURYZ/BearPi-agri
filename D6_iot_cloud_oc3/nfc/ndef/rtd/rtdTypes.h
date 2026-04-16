#ifndef RTDTYPES_H_
#define RTDTYPES_H_

#include "rtdText.h"
#include "rtdUri.h"


#define RTD_TEXT 'T'
#define RTD_URI  'U'

typedef union {
	RtdTextTypeStr text;
	RTDUriTypeStr uri;
} RTDTypeUnion;

typedef struct {
	uint8_t typeCode;
	RTDTypeUnion typePayload;
}RTDTypeStr;

#endif /* RTDTYPES_H_ */
