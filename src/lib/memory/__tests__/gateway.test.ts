/**
 * Unit tests for MemoryGateway interface
 * 
 * These tests verify the MemoryGateway interface type definitions and contracts.
 */

import { describe, it, expect } from '@jest/globals';
import type {
  MemoryGateway,
  AddMemoryParams,
  SearchMemoryParams,
  UpdateMemoryParams,
  MemoryResult,
  MemorySearchResult,
  SaveSessionMemoriesParams,
  GetMemoryContextParams,
  MemoryContext,
} from '../gateway';
import type { Persona } from '@/lib/supabase/types';

const basePersona: Persona = {
  id: 'persona1',
  name: 'Test Persona',
  avatar_url: null,
  gender: null,
  age: 28,
  occupation: 'Designer',
  city: 'Taipei',
  personality: 'Warm and thoughtful',
  speaking_style: 'Casual',
  background_story: null,
  hobbies: null,
  daily_habits: null,
  family_info: null,
  default_relationship: null,
  forbidden_patterns: null,
  example_dialogues: null,
  emotional_traits: null,
  quirks: null,
  is_active: true,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

describe('MemoryGateway Interface', () => {
  describe('Type Definitions', () => {
    it('should define AddMemoryParams with required fields', () => {
      const params: AddMemoryParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        memoryType: 'user_fact',
        content: 'Test memory content',
      };

      expect(params.userId).toBeDefined();
      expect(params.personaId).toBeDefined();
      expect(params.memoryType).toBeDefined();
      expect(params.content).toBeDefined();
    });

    it('should allow optional fields in AddMemoryParams', () => {
      const params: AddMemoryParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        memoryType: 'user_fact',
        content: 'Test memory',
        importance: 0.8,
        sourceSessionId: 'session1',
      };

      expect(params.importance).toBe(0.8);
      expect(params.sourceSessionId).toBe('session1');
    });

    it('should define SearchMemoryParams with required fields', () => {
      const params: SearchMemoryParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        query: 'search query',
      };

      expect(params.userId).toBeDefined();
      expect(params.personaId).toBeDefined();
      expect(params.query).toBeDefined();
    });

    it('should allow optional fields in SearchMemoryParams', () => {
      const params: SearchMemoryParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        query: 'search query',
        limit: 10,
        memoryTypes: ['user_fact', 'shared_event'],
      };

      expect(params.limit).toBe(10);
      expect(params.memoryTypes).toHaveLength(2);
    });

    it('should define UpdateMemoryParams with required memoryId', () => {
      const params: UpdateMemoryParams = {
        memoryId: 'memory1',
      };

      expect(params.memoryId).toBeDefined();
    });

    it('should allow optional update fields in UpdateMemoryParams', () => {
      const params: UpdateMemoryParams = {
        memoryId: 'memory1',
        content: 'Updated content',
        importance: 0.9,
        memoryType: 'persona_fact',
      };

      expect(params.content).toBe('Updated content');
      expect(params.importance).toBe(0.9);
      expect(params.memoryType).toBe('persona_fact');
    });

    it('should define MemoryResult with all required fields', () => {
      const result: MemoryResult = {
        id: 'memory1',
        userId: 'user1',
        personaId: 'persona1',
        memoryType: 'user_fact',
        content: 'Memory content',
        importance: 0.7,
        sourceSessionId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(result.id).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.personaId).toBeDefined();
      expect(result.memoryType).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.importance).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should define MemorySearchResult with memories array and count', () => {
      const result: MemorySearchResult = {
        memories: [],
        totalCount: 0,
      };

      expect(result.memories).toBeDefined();
      expect(Array.isArray(result.memories)).toBe(true);
      expect(result.totalCount).toBeDefined();
    });

    it('should define SaveSessionMemoriesParams with all required fields', () => {
      const params: SaveSessionMemoriesParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        sessionId: 'session1',
        topics: ['topic1', 'topic2'],
        summary: 'Session summary',
        memories: [
          {
            memory_type: 'user_fact',
            content: 'User fact content',
          },
        ],
        profile: {
          summary: 'User profile summary',
        },
      };

      expect(params.userId).toBeDefined();
      expect(params.personaId).toBeDefined();
      expect(params.sessionId).toBeDefined();
      expect(params.topics).toBeDefined();
      expect(params.summary).toBeDefined();
      expect(params.memories).toBeDefined();
      expect(params.profile).toBeDefined();
    });

    it('should allow optional importance in SaveSessionMemoriesParams memories', () => {
      const params: SaveSessionMemoriesParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        sessionId: 'session1',
        topics: [],
        summary: '',
        memories: [
          {
            memory_type: 'user_fact',
            content: 'Content',
            importance: 0.8,
          },
        ],
        profile: {},
      };

      expect(params.memories[0].importance).toBe(0.8);
    });

    it('should define GetMemoryContextParams with all required fields', () => {
      const params: GetMemoryContextParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        persona: basePersona,
        query: 'search query',
      };

      expect(params.userId).toBeDefined();
      expect(params.personaId).toBeDefined();
      expect(params.persona).toBeDefined();
      expect(params.query).toBeDefined();
    });

    it('should allow optional limit in GetMemoryContextParams', () => {
      const params: GetMemoryContextParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        persona: basePersona,
        query: 'search query',
        limit: 10,
      };

      expect(params.limit).toBe(10);
    });

    it('should define MemoryContext with all required fields', () => {
      const context: MemoryContext = {
        userProfile: null,
        recentSummaries: [],
        relevantMemories: [],
      };

      expect(context.userProfile).toBeDefined();
      expect(context.recentSummaries).toBeDefined();
      expect(context.relevantMemories).toBeDefined();
      expect(Array.isArray(context.recentSummaries)).toBe(true);
      expect(Array.isArray(context.relevantMemories)).toBe(true);
    });
  });

  describe('Memory Type Constraints', () => {
    it('should accept valid memory types', () => {
      const validTypes: Array<AddMemoryParams['memoryType']> = [
        'user_fact',
        'persona_fact',
        'shared_event',
        'relationship',
        'session_summary',
      ];

      validTypes.forEach((type) => {
        const params: AddMemoryParams = {
          userId: 'user1',
          personaId: 'persona1',
          characterId: 'character1',
          memoryType: type,
          content: 'Test',
        };

        expect(params.memoryType).toBe(type);
      });
    });
  });

  describe('Interface Contract', () => {
    it('should define all required methods in MemoryGateway', () => {
      // This is a compile-time check - if the interface is missing methods,
      // TypeScript will fail to compile
      const mockGateway: MemoryGateway = {
        add: async () => ({
          id: '1',
          userId: 'user1',
          personaId: 'persona1',
          memoryType: 'user_fact',
          content: 'test',
          importance: 0.5,
          sourceSessionId: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }),
        search: async () => ({
          memories: [],
          totalCount: 0,
        }),
        update: async () => ({
          id: '1',
          userId: 'user1',
          personaId: 'persona1',
          memoryType: 'user_fact',
          content: 'test',
          importance: 0.5,
          sourceSessionId: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }),
        delete: async () => {},
        saveSessionMemories: async () => ({
          memories: [],
          profile: {
            id: '1',
            user_id: 'user1',
            persona_id: 'persona1',
            character_id: 'character1',
            profile_data: {
              summary: '',
              facts: [],
              preferences: [],
              relationship_notes: [],
              recent_topics: [],
              anchors: [],
            },
            relationship_stage: 'new',
            total_messages: 0,
            updated_at: '2024-01-01',
          },
        }),
        getMemoryContext: async () => ({
          userProfile: null,
          recentSummaries: [],
          relevantMemories: [],
        }),
        getUserProfile: async () => null,
      };

      expect(mockGateway.add).toBeDefined();
      expect(mockGateway.search).toBeDefined();
      expect(mockGateway.update).toBeDefined();
      expect(mockGateway.delete).toBeDefined();
      expect(mockGateway.saveSessionMemories).toBeDefined();
      expect(mockGateway.getMemoryContext).toBeDefined();
      expect(mockGateway.getUserProfile).toBeDefined();
    });

    it('should have async methods that return Promises', async () => {
      const mockGateway: MemoryGateway = {
        add: async () => ({
          id: '1',
          userId: 'user1',
          personaId: 'persona1',
          memoryType: 'user_fact',
          content: 'test',
          importance: 0.5,
          sourceSessionId: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }),
        search: async () => ({
          memories: [],
          totalCount: 0,
        }),
        update: async () => ({
          id: '1',
          userId: 'user1',
          personaId: 'persona1',
          memoryType: 'user_fact',
          content: 'test',
          importance: 0.5,
          sourceSessionId: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }),
        delete: async () => {},
        saveSessionMemories: async () => ({
          memories: [],
          profile: {
            id: '1',
            user_id: 'user1',
            persona_id: 'persona1',
            character_id: 'character1',
            profile_data: {
              summary: '',
              facts: [],
              preferences: [],
              relationship_notes: [],
              recent_topics: [],
              anchors: [],
            },
            relationship_stage: 'new',
            total_messages: 0,
            updated_at: '2024-01-01',
          },
        }),
        getMemoryContext: async () => ({
          userProfile: null,
          recentSummaries: [],
          relevantMemories: [],
        }),
        getUserProfile: async () => null,
      };

      // Verify all methods return Promises
      expect(mockGateway.add({} as AddMemoryParams)).toBeInstanceOf(Promise);
      expect(mockGateway.search({} as SearchMemoryParams)).toBeInstanceOf(Promise);
      expect(mockGateway.update({} as UpdateMemoryParams)).toBeInstanceOf(Promise);
      expect(mockGateway.delete('id')).toBeInstanceOf(Promise);
      expect(mockGateway.saveSessionMemories({} as SaveSessionMemoriesParams)).toBeInstanceOf(Promise);
      expect(mockGateway.getMemoryContext({} as GetMemoryContextParams)).toBeInstanceOf(Promise);
      expect(mockGateway.getUserProfile('user1', 'persona1', 'character1')).toBeInstanceOf(Promise);
    });
  });

  describe('Null and Optional Handling', () => {
    it('should allow null for sourceSessionId in MemoryResult', () => {
      const result: MemoryResult = {
        id: 'memory1',
        userId: 'user1',
        personaId: 'persona1',
        memoryType: 'user_fact',
        content: 'Content',
        importance: 0.5,
        sourceSessionId: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      expect(result.sourceSessionId).toBeNull();
    });

    it('should allow null for userProfile in MemoryContext', () => {
      const context: MemoryContext = {
        userProfile: null,
        recentSummaries: [],
        relevantMemories: [],
      };

      expect(context.userProfile).toBeNull();
    });

    it('should allow undefined for optional fields', () => {
      const params: AddMemoryParams = {
        userId: 'user1',
        personaId: 'persona1',
        characterId: 'character1',
        memoryType: 'user_fact',
        content: 'Content',
        // importance and sourceSessionId are optional
      };

      expect(params.importance).toBeUndefined();
      expect(params.sourceSessionId).toBeUndefined();
    });
  });
});
