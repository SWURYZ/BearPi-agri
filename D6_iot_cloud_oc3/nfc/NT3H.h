#ifndef NT3H_H_
#define NT3H_H_

#include "stdbool.h"
#include <stdint.h>

#define NT3H1X_SLAVE_ADDRESS 0x55  

#define MANUFACTORING_DATA_REG 0x0
#define USER_START_REG 0x1


//  NT3H1201             // for th 2K
#define USER_END_REG   0x77 
#define CONFIG_REG	   0x7A
// NT3H1101                     // for th 1K
// #define USER_END_REG   0x38 // just the first 8 bytes for th 1K
// #define CONFIG_REG	   0x3A


#define SRAM_START_REG 0xF8
#define SRAM_END_REG   0xFB // just the first 8 bytes

#define SESSION_REG	   0xFE

#define NFC_PAGE_SIZE 16

typedef enum {
    NT3HERROR_NO_ERROR,
    NT3HERROR_READ_HEADER,
    NT3HERROR_WRITE_HEADER,
    NT3HERROR_INVALID_USER_MEMORY_PAGE,
    NT3HERROR_READ_USER_MEMORY_PAGE,
    NT3HERROR_WRITE_USER_MEMORY_PAGE,
    NT3HERROR_ERASE_USER_MEMORY_PAGE,
    NT3HERROR_READ_NDEF_TEXT,
    NT3HERROR_WRITE_NDEF_TEXT,
    NT3HERROR_TYPE_NOT_SUPPORTED
}NT3HerrNo;

extern uint8_t      nfcPageBuffer[NFC_PAGE_SIZE];
extern NT3HerrNo    errNo;

typedef enum {
    NDEFFirstPos,
    NDEFMiddlePos,
    NDEFLastPos
} RecordPosEnu;
/*
 * This strucure is used in the ADD record functionality
 * to store the last nfc page information, in order to continue from that point.
 */
typedef struct {
    uint8_t page;
    uint8_t usedBytes;
} UncompletePageStr;


typedef struct {
    RecordPosEnu ndefPosition;
    uint8_t rtdType;
    uint8_t *rtdPayload;
    uint8_t rtdPayloadlength;
    void    *specificRtdData;
}NDEFDataStr;


void NT3HGetNxpSerialNumber(char* buffer);

/*
 * read the user data from the requested page
 * first page is 0
 *
 * the NT3H1201 has 119 PAges 
 * the NT3H1101 has 56 PAges (but the 56th page has only 8 Bytes)
*/
bool NT3HReadUserData(uint8_t page);

/*
 * Write data information from the starting requested page.
 * If the dataLen is bigger of NFC_PAGE_SIZE, the consecuiteve needed 
 * pages will be automatically used.
 * 
 * The functions stops to the latest available page.
 * 
 first page is 0
 * the NT3H1201 has 119 PAges 
 * the NT3H1101 has 56 PAges (but the 56th page has only 8 Bytes)
*/
bool NT3HWriteUserData(uint8_t page, const uint8_t* data);

/*
 * The function read the first page of user data where is stored the NFC Header.
 * It is important because it contains the total size of all the stored records.
 *
 * param endRecordsPtr return the value of the total size excluding the NDEF_END_BYTE
 * param ndefHeader    Store the NDEF Header of the first record
 */
bool NT3HReadHeaderNfc(uint8_t *endRecordsPtr, uint8_t *ndefHeader);

/*
 * The function write the first page of user data where is stored the NFC Header.
 * update the bytes that contains the payload Length and the first NDEF Header
 *
 * param endRecordsPtr The value of the total size excluding the NDEF_END_BYTE
 * param ndefHeader    The NDEF Header of the first record
 */
bool NT3HWriteHeaderNfc(uint8_t endRecordsPtr, uint8_t ndefHeader);

bool getSessionReg(void);
bool getNxpUserData(char* buffer);
bool NT3HReadSram(void);
bool NT3HReadSession(void);
bool NT3HReadConfiguration(uint8_t *configuration);

bool NT3HEraseAllTag(void);

bool NT3HReaddManufactoringData(uint8_t *manuf) ;

bool NT3HResetUserData(void);

#endif /* NFC_H_ */
