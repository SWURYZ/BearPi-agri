package com.smartagri.smoke.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SmokeMapper {

    @Select("select 1")
    Integer selectOne();
}
