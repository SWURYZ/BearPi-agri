package com.smartagri.greenhousemonitor;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:greenhousemonitor;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "huaweicloud.iotda.command-enabled=false"
})
class GreenhouseMonitorApplicationTests {

    @Test
    void contextLoads() {
    }
}
