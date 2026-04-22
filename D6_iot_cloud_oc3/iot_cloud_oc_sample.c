
/*
 * Copyright (c) 2020 Nanjing Xiaoxiongpai Intelligent Technology Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include "ohos_init.h"
#include "cmsis_os2.h"

#include "wifi_connect.h"
#include "lwip/sockets.h"

#include "oc_mqtt.h"
#include "E53_IA1.h"
#include "nfc.h"
#include "NT3H.h"
#include "wifiiot_pwm.h"
#include "wifiiot_gpio.h"
#include "wifiiot_gpio_ex.h"

#define MSGQUEUE_OBJECTS 16
#define MAIN_TASK_STACK_SIZE 10240
#define MAIN_TASK_PRIO 24
#define SENSOR_TASK_STACK_SIZE 4096
#define SENSOR_TASK_PRIO 25
#define NFC_TASK_STACK_SIZE 4096
#define NFC_TASK_PRIO 25
#define PWM_TASK_STACK_SIZE 1024
#define PWM_TASK_PRIO 26

#define PWM_PERIOD 40000
#define PWM_DUTY_STEP 200
#define PWM_STEP_DELAY_US 10000

#define NFC_URI "10.157.218.245:5173/insect"
#define NFC_BOOT_TEXT "BearPi OC3 NFC Ready"
#define NFC_SYNC_INTERVAL_S 30

static osMessageQueueId_t mid_MsgQueue;
static osMutexId_t g_i2c_mutex;
static osMutexId_t g_sensor_mutex;
static E53_IA1_Data_TypeDef g_latest_sensor_data;
static bool g_sensor_data_valid = false;

#define CLIENT_ID "69d75b1d7f2e6c302f654fea_20031104_0_0_2026041100"
#define USERNAME "69d75b1d7f2e6c302f654fea_20031104"
#define PASSWORD "8c68d54707f078ccf179062900d3c2f45bd0099185914a43fd1b9f0d621158a5"

typedef enum
{
    en_msg_cmd = 0,
    en_msg_report,
} en_msg_type_t;

typedef struct
{
    char *request_id;
    char *payload;
} cmd_t;

typedef struct
{
    int lum;
    int temp;
    int hum;
} report_t;

typedef struct
{
    en_msg_type_t msg_type;
    union
    {
        cmd_t cmd;
        report_t report;
    } msg;
} app_msg_t;

typedef struct
{
    int connected;
    int led;
    int motor;
} app_cb_t;
static app_cb_t g_app_cb;

static void I2cBusLock(void)
{
    if (g_i2c_mutex != NULL) {
        (void)osMutexAcquire(g_i2c_mutex, osWaitForever);
    }
}

static void I2cBusUnlock(void)
{
    if (g_i2c_mutex != NULL) {
        (void)osMutexRelease(g_i2c_mutex);
    }
}

static void SaveLatestSensorData(const E53_IA1_Data_TypeDef *data)
{
    if ((g_sensor_mutex == NULL) || (data == NULL)) {
        return;
    }

    (void)osMutexAcquire(g_sensor_mutex, osWaitForever);
    g_latest_sensor_data = *data;
    g_sensor_data_valid = true;
    (void)osMutexRelease(g_sensor_mutex);
}

static bool LoadLatestSensorData(E53_IA1_Data_TypeDef *data)
{
    bool valid = false;

    if ((g_sensor_mutex == NULL) || (data == NULL)) {
        return false;
    }

    (void)osMutexAcquire(g_sensor_mutex, osWaitForever);
    if (g_sensor_data_valid) {
        *data = g_latest_sensor_data;
        valid = true;
    }
    (void)osMutexRelease(g_sensor_mutex);

    return valid;
}

static void BreathLedInit(void)
{
    GpioInit();
    IoSetFunc(WIFI_IOT_IO_NAME_GPIO_2, WIFI_IOT_IO_FUNC_GPIO_2_PWM2_OUT);
    GpioSetDir(WIFI_IOT_IO_NAME_GPIO_2, WIFI_IOT_GPIO_DIR_OUT);
    PwmInit(WIFI_IOT_PWM_PORT_PWM2);
}

static void NfcWriteTextAndUri(const char *text)
{
    bool ok;

    if (text == NULL) {
        return;
    }

    I2cBusLock();
    ok = NT3HEraseAllTag();
    if (ok) {
        ok = storeText(NDEFFirstPos, (uint8_t *)text);
    }
    if (ok) {
        ok = storeUrihttp(NDEFLastPos, (uint8_t *)NFC_URI);
    }
    I2cBusUnlock();

    if (!ok) {
        printf("NFC sync failed, err=%d\r\n", errNo);
    }
}

static void UpdateNfcTagWithSensorData(const E53_IA1_Data_TypeDef *data)
{
    char text[96];
    int ret;

    if (data == NULL) {
        return;
    }

    ret = snprintf(text, sizeof(text), "T:%.1fC H:%.1f%% L:%.1flux C:%s LED:%s M:%s",
        data->Temperature, data->Humidity, data->Lux,
        g_app_cb.connected ? "ON" : "OFF",
        g_app_cb.led ? "ON" : "OFF",
        g_app_cb.motor ? "ON" : "OFF");
    if (ret < 0) {
        return;
    }

    text[sizeof(text) - 1] = '\0';
    NfcWriteTextAndUri(text);
}

static void deal_report_msg(report_t *report)
{
    oc_mqtt_profile_service_t service;
    oc_mqtt_profile_kv_t temperature;
    oc_mqtt_profile_kv_t humidity;
    oc_mqtt_profile_kv_t luminance;
    oc_mqtt_profile_kv_t led;
    oc_mqtt_profile_kv_t motor;

    service.event_time = NULL;
    service.service_id = "Agriculture";
    service.service_property = &temperature;
    service.nxt = NULL;

    temperature.key = "Temperature";
    temperature.value = &report->temp;
    temperature.type = EN_OC_MQTT_PROFILE_VALUE_INT;
    temperature.nxt = &humidity;

    humidity.key = "Humidity";
    humidity.value = &report->hum;
    humidity.type = EN_OC_MQTT_PROFILE_VALUE_INT;
    humidity.nxt = &luminance;

    luminance.key = "Luminance";
    luminance.value = &report->lum;
    luminance.type = EN_OC_MQTT_PROFILE_VALUE_INT;
    luminance.nxt = &led;

    led.key = "LightStatus";
    led.value = g_app_cb.led ? "ON" : "OFF";
    led.type = EN_OC_MQTT_PROFILE_VALUE_STRING;
    led.nxt = &motor;

    motor.key = "MotorStatus";
    motor.value = g_app_cb.motor ? "ON" : "OFF";
    motor.type = EN_OC_MQTT_PROFILE_VALUE_STRING;
    motor.nxt = NULL;

    oc_mqtt_profile_propertyreport(USERNAME, &service);
    return;
}

void oc_msg_rsp_cb(uint8_t *recv_data, size_t recv_size, uint8_t **resp_data, size_t *resp_size)
{
    app_msg_t *app_msg;
    int ret = 0;

    app_msg = malloc(sizeof(app_msg_t));
    if (app_msg == NULL) {
        *resp_data = NULL;
        *resp_size = 0;
        return;
    }
    app_msg->msg_type = en_msg_cmd;
    app_msg->msg.cmd.payload = NULL;

    // 深拷贝 payload，防止底层 buffer 被释放或复写
    app_msg->msg.cmd.payload = malloc(recv_size + 1);
    if (app_msg->msg.cmd.payload != NULL) {
        memcpy(app_msg->msg.cmd.payload, recv_data, recv_size);
        app_msg->msg.cmd.payload[recv_size] = '\0';
    } else {
        free(app_msg);
        *resp_data = NULL;
        *resp_size = 0;
        return;
    }

    printf("recv message is %.*s\n", recv_size, recv_data);
    ret = osMessageQueuePut(mid_MsgQueue, &app_msg, 0U, 0U);
    if (ret != 0)
    {
        if (app_msg->msg.cmd.payload != NULL) {
            free(app_msg->msg.cmd.payload);
        }
        free(app_msg);
    }
    *resp_data = NULL;
    *resp_size = 0;
}

///< COMMAND DEAL
#include <cJSON.h>
static void deal_cmd_msg(cmd_t *cmd)
{
    cJSON *obj_root;
    cJSON *obj_content;
    cJSON *obj_led;
    cJSON *obj_motor;

    if ((cmd == NULL) || (cmd->payload == NULL)) {
        return;
    }

    printf("Received message payload: %s\n", cmd->payload);

    obj_root = cJSON_Parse(cmd->payload);
    if (NULL == obj_root)
    {
        printf("Failed to parse JSON\n");
        goto EXIT;
    }

    // 提取 content 节点
    obj_content = cJSON_GetObjectItem(obj_root, "content");
    if (NULL == obj_content)
    {
        printf("No 'content' field in JSON\n");
        goto EXIT_JSON;
    }

    // 处理 LED 控制
    obj_led = cJSON_GetObjectItem(obj_content, "led");
    if (obj_led != NULL && obj_led->valuestring != NULL)
    {
        if (0 == strcmp(obj_led->valuestring, "ON"))
        {
            g_app_cb.led = 1;
            Light_StatusSet(ON);
            printf("Light On!\n");
        }
        else if (0 == strcmp(obj_led->valuestring, "OFF"))
        {
            g_app_cb.led = 0;
            Light_StatusSet(OFF);
            printf("Light Off!\n");
        }
    }

    // 处理 Motor 控制
    obj_motor = cJSON_GetObjectItem(obj_content, "motor");
    if (obj_motor != NULL && obj_motor->valuestring != NULL)
    {
        if (0 == strcmp(obj_motor->valuestring, "ON"))
        {
            g_app_cb.motor = 1;
            Motor_StatusSet(ON);
            printf("Motor On!\n");
        }
        else if (0 == strcmp(obj_motor->valuestring, "OFF"))
        {
            g_app_cb.motor = 0;
            Motor_StatusSet(OFF);
            printf("Motor Off!\n");
        }
    }

EXIT_JSON:
    cJSON_Delete(obj_root);
EXIT:
    if (cmd->payload != NULL) {
        free(cmd->payload);
        cmd->payload = NULL;
    }
}

static int task_main_entry(void)
{
    app_msg_t *app_msg;
    uint32_t ret;
    int mqtt_ret;

    ret = WifiConnect("400", "ryz20031104");
    if (ret != 0)
    {
        printf("WifiConnect failed:%lu\r\n", (unsigned long)ret);
    }

    device_info_init(CLIENT_ID, USERNAME, PASSWORD);
    mqtt_ret = oc_mqtt_init();
    if (mqtt_ret != 0)
    {
        printf("oc_mqtt_init failed:%d\r\n", mqtt_ret);
        g_app_cb.connected = 0;
    }
    else
    {
        g_app_cb.connected = 1;
        oc_set_msg_rsp_cb(oc_msg_rsp_cb);
    }

    while (1)
    {
        app_msg = NULL;
        (void)osMessageQueueGet(mid_MsgQueue, (void **)&app_msg, NULL, 0U);
        if (NULL != app_msg)
        {
            switch (app_msg->msg_type)
            {
            case en_msg_cmd:
                deal_cmd_msg(&app_msg->msg.cmd);
                break;
            case en_msg_report:
                deal_report_msg(&app_msg->msg.report);
                break;
            default:
                break;
            }
            free(app_msg);
        }
    }
    return 0;
}

static int task_sensor_entry(void)
{
    app_msg_t *app_msg;
    E53_IA1_Data_TypeDef data;

    while (1)
    {
        I2cBusLock();
        E53_IA1_Read_Data(&data);
        I2cBusUnlock();
        SaveLatestSensorData(&data);
        app_msg = malloc(sizeof(app_msg_t));
        printf("SENSOR:lum:%.2f temp:%.2f hum:%.2f\r\n", data.Lux, data.Temperature, data.Humidity);
        if (NULL != app_msg)
        {
            app_msg->msg_type = en_msg_report;
            app_msg->msg.report.hum = (int)data.Humidity;
            app_msg->msg.report.lum = (int)data.Lux;
            app_msg->msg.report.temp = (int)data.Temperature;
            if (0 != osMessageQueuePut(mid_MsgQueue, &app_msg, 0U, 0U))
            {
                free(app_msg);
            }
        }
        sleep(3);
    }
    return 0;
}

static int task_nfc_entry(void)
{
    E53_IA1_Data_TypeDef data;

    NfcWriteTextAndUri(NFC_BOOT_TEXT);
    sleep(1);

    while (1)
    {
        if (LoadLatestSensorData(&data)) {
            UpdateNfcTagWithSensorData(&data);
        }
        sleep(NFC_SYNC_INTERVAL_S);
    }

    return 0;
}

static int task_breath_led_entry(void)
{
    int duty;

    BreathLedInit();
    while (1)
    {
        for (duty = 0; duty <= PWM_PERIOD; duty += PWM_DUTY_STEP)
        {
            PwmStart(WIFI_IOT_PWM_PORT_PWM2, (unsigned int)duty, PWM_PERIOD);
            usleep(PWM_STEP_DELAY_US);
        }

        for (duty = PWM_PERIOD; duty >= 0; duty -= PWM_DUTY_STEP)
        {
            PwmStart(WIFI_IOT_PWM_PORT_PWM2, (unsigned int)duty, PWM_PERIOD);
            usleep(PWM_STEP_DELAY_US);
        }
    }

    return 0;
}

static void OC_Demo(void)
{
    mid_MsgQueue = osMessageQueueNew(MSGQUEUE_OBJECTS, sizeof(app_msg_t *), NULL);
    if (mid_MsgQueue == NULL)
    {
        printf("Falied to create Message Queue!\n");
    }

    g_i2c_mutex = osMutexNew(NULL);
    g_sensor_mutex = osMutexNew(NULL);
    if ((g_i2c_mutex == NULL) || (g_sensor_mutex == NULL))
    {
        printf("Falied to create Mutex!\n");
        return;
    }

    g_app_cb.connected = 0;
    g_app_cb.led = 0;
    g_app_cb.motor = 0;

    I2cBusLock();
    E53_IA1_Init();
    I2cBusUnlock();
    Light_StatusSet(OFF);
    Motor_StatusSet(OFF);

    osThreadAttr_t attr;

    attr.name = "task_main_entry";
    attr.attr_bits = 0U;
    attr.cb_mem = NULL;
    attr.cb_size = 0U;
    attr.stack_mem = NULL;
    attr.stack_size = MAIN_TASK_STACK_SIZE;
    attr.priority = MAIN_TASK_PRIO;

    if (osThreadNew((osThreadFunc_t)task_main_entry, NULL, &attr) == NULL)
    {
        printf("Falied to create task_main_entry!\n");
    }
    attr.stack_size = SENSOR_TASK_STACK_SIZE;
    attr.priority = SENSOR_TASK_PRIO;
    attr.name = "task_sensor_entry";
    if (osThreadNew((osThreadFunc_t)task_sensor_entry, NULL, &attr) == NULL)
    {
        printf("Falied to create task_sensor_entry!\n");
    }

    attr.stack_size = NFC_TASK_STACK_SIZE;
    attr.priority = NFC_TASK_PRIO;
    attr.name = "task_nfc_entry";
    if (osThreadNew((osThreadFunc_t)task_nfc_entry, NULL, &attr) == NULL)
    {
        printf("Falied to create task_nfc_entry!\n");
    }

    attr.stack_size = PWM_TASK_STACK_SIZE;
    attr.priority = PWM_TASK_PRIO;
    attr.name = "task_breath_led_entry";
    if (osThreadNew((osThreadFunc_t)task_breath_led_entry, NULL, &attr) == NULL)
    {
        printf("Falied to create task_breath_led_entry!\n");
    }
}

APP_FEATURE_INIT(OC_Demo);
