/*----------------------------------------------------------------------------
 * Copyright (c) <2018>, <Huawei Technologies Co., Ltd>
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used
 * to endorse or promote products derived from this software without specific prior written
 * permission.
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *---------------------------------------------------------------------------*/
/*----------------------------------------------------------------------------
 * Notice of Export Control Law
 * ===============================================
 * Huawei LiteOS may be subject to applicable export control laws and regulations, which might
 * include those applicable to Huawei LiteOS of U.S. and the country in which you are located.
 * Import, export and usage of Huawei LiteOS in any manner by you shall be in compliance with such
 * applicable export control laws and regulations.
 *---------------------------------------------------------------------------*/
/**
 *  DATE                AUTHOR      INSTRUCTION
 *  2020-02-05 17:00  zhangqianfu  The first version
 *
 */

#include <string.h>
#include <stdio.h>
#include "MQTTClient.h"
#include <unistd.h>

#include "cJSON.h"

#include "cmsis_os2.h"

#include <oc_mqtt.h>
#include <oc_mqtt_profile_package.h>

typedef struct
{
    char                        *device_id;
    fn_oc_mqtt_profile_rcvdeal   rcvfunc;
}oc_mqtt_profile_cb_t;

static oc_mqtt_profile_cb_t s_oc_mqtt_profile_cb;


static char init_ok = FALSE;
static MQTTClient mq_client;
struct bp_oc_info oc_info;
struct oc_device
{
    struct bp_oc_info *oc_info;

    void(*cmd_rsp_cb)(uint8_t *recv_data, size_t recv_size, uint8_t **resp_data, size_t *resp_size);
    void(*msg_rsp_cb)(uint8_t *recv_data, size_t recv_size, uint8_t **resp_data, size_t *resp_size);

} oc_mqtt;

 void mqtt_callback(MessageData *msg_data)
{
    size_t res_len = 0;
    uint8_t *response_buf = NULL;
    char topicname[45] = { "$crsp/" };

    LOS_ASSERT(msg_data);

    //LOG_D("topic %.*s receive a message", msg_data->topicName->lenstring.len, msg_data->topicName->lenstring.data);
    //LOG_D("message length is %d", msg_data->message->payloadlen);

    // 检查是否为消息下发 (Message) 的 topic: $oc/devices/{device_id}/sys/messages/down
    if (strstr(msg_data->topicName->lenstring.data, "/sys/messages/down") != NULL)
    {
        if (oc_mqtt.msg_rsp_cb != NULL)
        {
            oc_mqtt.msg_rsp_cb((uint8_t *) msg_data->message->payload, msg_data->message->payloadlen, &response_buf, &res_len);
        }
    }
    // 检查是否为命令下发 (Command) 的 topic
    else if (strstr(msg_data->topicName->lenstring.data, "/sys/commands/request_id=") != NULL)
    {
        if (oc_mqtt.cmd_rsp_cb != NULL)
        {
            oc_mqtt.cmd_rsp_cb((uint8_t *) msg_data->message->payload, msg_data->message->payloadlen, &response_buf, &res_len);

            if (response_buf != NULL || res_len != 0)
            {
                strncat(topicname, &(msg_data->topicName->lenstring.data[6]), msg_data->topicName->lenstring.len - 6);
                oc_mqtt_publish(topicname, response_buf, strlen((const char *)response_buf),(int)en_mqtt_al_qos_1);
                free(response_buf);
            }
        }
    }
}
unsigned char *oc_mqtt_buf;
unsigned char *oc_mqtt_readbuf;
int buf_size;

Network n;
MQTTPacket_connectData data = MQTTPacket_connectData_initializer;  

static int oc_mqtt_entry(void)
{
    int rc = 0;
    
	NetworkInit(&n);
	NetworkConnect(&n, OC_SERVER_IP, OC_SERVER_PORT);

    buf_size  = 2048;
    oc_mqtt_buf = (unsigned char *) malloc(buf_size);
    oc_mqtt_readbuf = (unsigned char *) malloc(buf_size);
    if (!(oc_mqtt_buf && oc_mqtt_readbuf))
    {
        printf("No memory for MQTT client buffer!");
        return -2;
    }

	MQTTClientInit(&mq_client, &n, 1000, oc_mqtt_buf, buf_size, oc_mqtt_readbuf, buf_size);
	
    MQTTStartTask(&mq_client);


    data.keepAliveInterval = 30;
    data.cleansession = 1;
	data.clientID.cstring = oc_info.client_id;
	data.username.cstring = oc_info.username;
	data.password.cstring = oc_info.password;
	data.MQTTVersion =3;

	
    mq_client.defaultMessageHandler = mqtt_callback;

	rc = MQTTConnect(&mq_client, &data);

    return rc;
    
}


void device_info_init(char *client_id, char * username, char *password)
{
    oc_info.user_device_id_flg = 1;
    strncpy(oc_info.client_id,  client_id, strlen(client_id));
    strncpy(oc_info.username,     username, strlen(username));
    strncpy(oc_info.password,  password, strlen(password));

}

/**
 * oc mqtt client init.
 *
 * @param   NULL
 *
 * @return  0 : init success
 *         -1 : get device info fail
 *         -2 : oc mqtt client init fail
 */
int oc_mqtt_init(void)
{
    int result = 0;

    if (init_ok)
    {
        //LOG_D("oc mqtt already init!");
        return 0;
    }
    if (oc_mqtt_entry() < 0)
    {
        result = -2;
        goto __exit;
    }
    __exit:
    if (!result)
    {
        //LOG_I("oc package(V%s) initialize success.", oc_SW_VERSION);
        init_ok = 0;
    }
    else
    {
        //LOG_E("oc package(V%s) initialize failed(%d).", oc_SW_VERSION, result);
    }
    return result;
}
/**
 * set the command responses call back function
 *
 * @param   cmd_rsp_cb  command responses call back function
 *
 * @return  0 : set success
 *         -1 : function is null
 */
void oc_set_cmd_rsp_cb(void (*cmd_rsp_cb)(uint8_t *recv_data, uint32_t recv_size, uint8_t **resp_data, uint32_t *resp_size))
{
    oc_mqtt.cmd_rsp_cb = cmd_rsp_cb;
}

/**
 * set the message responses call back function
 *
 * @param   msg_rsp_cb  message responses call back function
 */
void oc_set_msg_rsp_cb(void (*msg_rsp_cb)(uint8_t *recv_data, uint32_t recv_size, uint8_t **resp_data, uint32_t *resp_size))
{
    oc_mqtt.msg_rsp_cb = msg_rsp_cb;
}


/**
 * mqtt publish msg to topic
 *
 * @param   topic   target topic
 * @param   msg     message to be sent
 * @param   len     message length
 *
 * @return  0 : publish success
 *         -1 : publish fail
 */
 int oc_mqtt_publish(char  *topic,uint8_t *msg,int msg_len,int qos)
{
    MQTTMessage message;

    LOS_ASSERT(topic);
    LOS_ASSERT(msg);

    message.qos = qos;
    message.retained = 0;
    message.payload = (void *) msg;
    message.payloadlen = msg_len;

    if (MQTTPublish(&mq_client, topic, &message) < 0)
    {
        return -1;
    }

    return 0;
}
///< use this function to make a topic to publish
///< if request_id  is needed depends on the fmt
static char *topic_make(char *fmt, char *device_id, char *request_id)
{
    int len;
    char *ret = NULL;

    if(NULL == device_id)
    {
        return ret;
    }
    len = strlen(fmt) + strlen(device_id);
    if(NULL != request_id)
    {
        len += strlen(request_id);
    }

    ret = malloc(len);
    if(NULL != ret)
    {
        (void) snprintf(ret,len,fmt,device_id,request_id);
    }
    return ret;
}


///< use this function to report the messsage
#define CN_OC_MQTT_PROFILE_MSGUP_TOPICFMT   "$oc/devices/%s/sys/messages/up"
int oc_mqtt_profile_msgup(char *deviceid,oc_mqtt_profile_msgup_t *payload)
{
    int ret = (int)en_oc_mqtt_err_parafmt;
    char *topic;
    char *msg;

    if(NULL == deviceid)
    {
        if(NULL == s_oc_mqtt_profile_cb.device_id)
        {
            return ret;
        }
        else
        {
            deviceid = s_oc_mqtt_profile_cb.device_id;
        }
    }

    if((NULL == payload) || (NULL == payload->msg))
    {
        return ret;
    }

    topic = topic_make(CN_OC_MQTT_PROFILE_MSGUP_TOPICFMT, deviceid,NULL);
    msg = oc_mqtt_profile_package_msgup(payload);

    if((NULL != topic) && (NULL != msg))
    {
        ret = oc_mqtt_publish(topic,(uint8_t *)msg,strlen(msg),(int)en_mqtt_al_qos_1);
    }
    else
    {
        ret = (int)en_oc_mqtt_err_sysmem;
    }

    free(topic);
    free(msg);

    return ret;
}

#define CN_OC_MQTT_PROFILE_PROPERTYREPORT_TOPICFMT   "$oc/devices/%s/sys/properties/report"
int oc_mqtt_profile_propertyreport(char *deviceid,oc_mqtt_profile_service_t *payload)
{
    int ret = (int)en_oc_mqtt_err_parafmt;
    char *topic;
    char *msg;

    if(NULL == deviceid)
    {
        if(NULL == s_oc_mqtt_profile_cb.device_id)
        {
            return ret;
        }
        else
        {
            deviceid = s_oc_mqtt_profile_cb.device_id;
        }
    }

    if((NULL== payload) || (NULL== payload->service_id) || (NULL == payload->service_property))
    {
        return ret;
    }

    topic = topic_make(CN_OC_MQTT_PROFILE_PROPERTYREPORT_TOPICFMT, deviceid,NULL);
    msg = oc_mqtt_profile_package_propertyreport(payload);

    if((NULL != topic) && (NULL != msg))
    {
        ret = oc_mqtt_publish(topic,(uint8_t *)msg,strlen(msg),(int)en_mqtt_al_qos_1);
    }
    else
    {
        ret = (int)en_oc_mqtt_err_sysmem;
    }

    free(topic);
    free(msg);

    return ret;
}

#define CN_OC_MQTT_PROFILE_GWPROPERTYREPORT_TOPICFMT   "$oc/devices/%s/sys/gateway/sub_devices/properties/report"
int oc_mqtt_profile_gwpropertyreport(char *deviceid,oc_mqtt_profile_device_t *payload)
{
    int ret = (int)en_oc_mqtt_err_parafmt;
    char *topic;
    char *msg;

    if(NULL == deviceid)
    {
        if(NULL == s_oc_mqtt_profile_cb.device_id)
        {
            return ret;
        }
        else
        {
            deviceid = s_oc_mqtt_profile_cb.device_id;
        }
    }

    if((NULL== payload) || (NULL == payload->subdevice_id)||(NULL== payload->subdevice_property) ||\
       (NULL== payload->subdevice_property->service_id)||(NULL== payload->subdevice_property->service_property))
    {
        return ret;
    }

    topic = topic_make(CN_OC_MQTT_PROFILE_GWPROPERTYREPORT_TOPICFMT, deviceid,NULL);
    msg = oc_mqtt_profile_package_gwpropertyreport(payload);

    if((NULL != topic) && (NULL != msg))
    {
        ret = oc_mqtt_publish(topic,(uint8_t *)msg,strlen(msg),(int)en_mqtt_al_qos_1);
    }
    else
    {
        ret = (int)en_oc_mqtt_err_sysmem;
    }

    free(topic);
    free(msg);

    return ret;
}


#define CN_OC_MQTT_PROFILE_ROPERTYSETRESP_TOPICFMT   "$oc/devices/%s/sys/properties/set/response/request_id=%s"
int oc_mqtt_profile_propertysetresp(char *deviceid,oc_mqtt_profile_propertysetresp_t *payload)
{
    int ret = (int)en_oc_mqtt_err_parafmt;
    char *topic;
    char *msg;

    if(NULL == deviceid)
    {
        if(NULL == s_oc_mqtt_profile_cb.device_id)
        {
            return ret;
        }
        else
        {
            deviceid = s_oc_mqtt_profile_cb.device_id;
        }
    }

    if((NULL == payload) || (NULL == payload->request_id))
    {
        return ret;
    }
    topic = topic_make(CN_OC_MQTT_PROFILE_ROPERTYSETRESP_TOPICFMT, deviceid,payload->request_id);
    msg = oc_mqtt_profile_package_propertysetresp(payload);

    if((NULL != topic) && (NULL != msg))
    {
        ret = oc_mqtt_publish(topic,(uint8_t *)msg,strlen(msg),(int)en_mqtt_al_qos_1);
    }
    else
    {
        ret = (int)en_oc_mqtt_err_sysmem;
    }

    free(topic);
    free(msg);

    return ret;
}


#define CN_OC_MQTT_PROFILE_ROPERTYGETRESP_TOPICFMT   "$oc/devices/%s/sys/properties/get/response/request_id=%s"
int oc_mqtt_profile_propertygetresp(char *deviceid,oc_mqtt_profile_propertygetresp_t *payload)
{
    int ret = (int)en_oc_mqtt_err_parafmt;
    char *topic;
    char *msg;

    if(NULL == deviceid)
    {
        if(NULL == s_oc_mqtt_profile_cb.device_id)
        {
            return ret;
        }
        else
        {
            deviceid = s_oc_mqtt_profile_cb.device_id;
        }
    }

    if((NULL== payload) || (NULL == payload->request_id) || \
       (NULL== payload->services->service_id) || (NULL == payload->services->service_property))
    {
        return ret;
    }

    topic = topic_make(CN_OC_MQTT_PROFILE_ROPERTYGETRESP_TOPICFMT, deviceid,payload->request_id);
    msg = oc_mqtt_profile_package_propertygetresp(payload);

    if((NULL != topic) && (NULL != msg))
    {
        ret = oc_mqtt_publish(topic,(uint8_t *)msg,strlen(msg),(int)en_mqtt_al_qos_1);
    }
    else
    {
        ret = (int)en_oc_mqtt_err_sysmem;
    }

    free(topic);
    free(msg);

    return ret;
}

#define CN_OC_MQTT_PROFILE_CMDRESP_TOPICFMT   "$oc/devices/%s/sys/commands/response/request_id=%s"
int oc_mqtt_profile_cmdresp(char *deviceid,oc_mqtt_profile_cmdresp_t *payload)
{
    int ret = (int)en_oc_mqtt_err_parafmt;
    char *topic;
    char *msg;

    if(NULL == deviceid)
    {
        if(NULL == s_oc_mqtt_profile_cb.device_id)
        {
            return ret;
        }
        else
        {
            deviceid = s_oc_mqtt_profile_cb.device_id;
        }
    }

    if((NULL == payload) || (NULL == payload->request_id))
    {
        return ret;
    }

    topic = topic_make(CN_OC_MQTT_PROFILE_CMDRESP_TOPICFMT, deviceid,payload->request_id);
    msg = oc_mqtt_profile_package_cmdresp(payload);

    if((NULL != topic) && (NULL != msg))
    {
        ret = oc_mqtt_publish(topic,(uint8_t *)msg,strlen(msg),(int)en_mqtt_al_qos_1);
    }
    else
    {
        ret = (int)en_oc_mqtt_err_sysmem;
    }

    free(topic);
    free(msg);

    return ret;
}
