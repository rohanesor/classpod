import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './app.config';
import { validateEnvironment } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateEnvironment,
    }),
  ],
})
export class AppConfigModule {}
