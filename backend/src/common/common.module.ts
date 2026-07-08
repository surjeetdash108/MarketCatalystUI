import { Global, Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.provider';
import { SyncMetaService } from './sync-meta.service';

@Global()
@Module({
  providers: [FirebaseAdminService, SyncMetaService],
  exports: [FirebaseAdminService, SyncMetaService],
})
export class CommonModule {}
