package com.smartagri.iotaccess;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:iotaccess;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.flyway.enabled=false",
        "huaweicloud.iotda.command-enabled=false",
        "huaweicloud.iotda.amqp.enabled=false"
})
class IotAccessApplicationTests {

    @Test
    void contextLoads() {
    }
}
