import { ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

interface AuthenticatedTestRequest {
  user?: { id: string };
}

describe('BooksController', () => {
  let app: INestApplication<App>;
  const list = jest.fn();
  const get = jest.fn();
  const remove = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        ConfigService,
        SupabaseService,
        { provide: BooksService, useValue: { list, get, remove } },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<AuthenticatedTestRequest>().user = {
            id: 'user-1',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists the authenticated user books', async () => {
    list.mockResolvedValue([{ id: 'book-1', title: 'Cuento' }]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/books')
      .expect(200);

    expect(response.body).toEqual([{ id: 'book-1', title: 'Cuento' }]);
    expect(list).toHaveBeenCalledWith('user-1');
  });

  it('returns book details', async () => {
    get.mockResolvedValue({ id: 'book-1', pages: [] });

    const response = await request(app.getHttpServer())
      .get('/api/v1/books/book-1')
      .expect(200);

    expect(response.body).toEqual({ id: 'book-1', pages: [] });
    expect(get).toHaveBeenCalledWith('book-1', 'user-1');
  });

  it('soft deletes books with 204', async () => {
    remove.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/books/book-1')
      .expect(204);

    expect(remove).toHaveBeenCalledWith('book-1', 'user-1');
  });
});
