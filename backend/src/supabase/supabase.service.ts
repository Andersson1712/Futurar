import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient | null;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('SUPABASE_URL');
    const serviceKey = configService.get<string>('SUPABASE_SERVICE_KEY');

    this.client =
      url && serviceKey
        ? createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }
}
