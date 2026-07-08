import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // backendUI (a separate static origin) polls this API for job status
  const port = process.env.PORT ?? 4100;
  await app.listen(port);
  console.log(`finapp26-backend listening on port ${port}`);
}
void bootstrap();
