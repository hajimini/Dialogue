# Import Memory Flow Validation

- Generated at: 2026-03-31T04:08:27.443Z
- Base URL: http://localhost:3000

## Setup

- User: `demo@ai-companion.local`
- Persona: `小芮嫣` (`f9287933-a9e8-44c5-9c71-591e5449372e`)
- Character A: `默认角色` (`67e1ca2c-13b9-4ea7-8c34-399085ef05ab`)
- Character B: `import-isolation-b-e3ka8i` (`09ac68fd-c43d-4462-a9aa-a376a3b912d4`)
- Marker: `meteor-orchid-mne3kb80`

## Raw Results

```json
{
  "imported": {
    "session_id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
    "message_count": 4
  },
  "beforeATotal": {
    "total": 3,
    "memories": [
      {
        "id": "d313c9d4-b745-4d1c-9f27-f88dac87ce54",
        "content": "用户分享了个人喜好,小芮嫣记住了流星兰这个名字",
        "memory_type": "shared_event",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.439417+00:00",
        "updated_at": "2026-03-31T04:01:26.439417+00:00"
      },
      {
        "id": "94a54642-8078-46d9-9029-3a4b2515657d",
        "content": "周末常去海边散步",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.020458+00:00",
        "updated_at": "2026-03-31T04:01:26.020458+00:00"
      },
      {
        "id": "5a5e1693-df9a-43a2-baca-cdd7b79bc714",
        "content": "最喜欢的花是流星兰",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:25.544782+00:00",
        "updated_at": "2026-03-31T04:01:25.544782+00:00"
      }
    ]
  },
  "beforeBTotal": {
    "total": 0,
    "memories": []
  },
  "beforeAMarker": {
    "total": 0,
    "memories": []
  },
  "beforeBMarker": {
    "total": 0,
    "memories": []
  },
  "afterImportATotal": {
    "total": 3,
    "memories": [
      {
        "id": "d313c9d4-b745-4d1c-9f27-f88dac87ce54",
        "content": "用户分享了个人喜好,小芮嫣记住了流星兰这个名字",
        "memory_type": "shared_event",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.439417+00:00",
        "updated_at": "2026-03-31T04:01:26.439417+00:00"
      },
      {
        "id": "94a54642-8078-46d9-9029-3a4b2515657d",
        "content": "周末常去海边散步",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.020458+00:00",
        "updated_at": "2026-03-31T04:01:26.020458+00:00"
      },
      {
        "id": "5a5e1693-df9a-43a2-baca-cdd7b79bc714",
        "content": "最喜欢的花是流星兰",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:25.544782+00:00",
        "updated_at": "2026-03-31T04:01:25.544782+00:00"
      }
    ]
  },
  "afterImportBTotal": {
    "total": 0,
    "memories": []
  },
  "afterImportAMarker": {
    "total": 0,
    "memories": []
  },
  "afterImportBMarker": {
    "total": 0,
    "memories": []
  },
  "adminAfterImportA": {
    "total": 3,
    "profile": {
      "id": "5d2c3e3f-704a-42a1-b504-a715f7dc6d18",
      "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
      "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
      "profile_data": {
        "facts": [
          "最喜欢的花是流星兰",
          "周末常去海边散步"
        ],
        "anchors": [
          "流星兰",
          "海边",
          "喜好的花",
          "周末活动",
          "海边散步",
          "最喜欢的花是流星兰",
          "周末常去海边散步",
          "用户分享了个人喜好,小芮嫣记住了流星兰这个名字",
          "我最喜欢的花是流",
          "星兰"
        ],
        "summary": "喜欢流星兰,周末喜欢去海边散步放松",
        "preferences": [
          "喜欢流星兰",
          "喜欢海边散步"
        ],
        "recent_topics": [
          "流星兰",
          "海边散步"
        ],
        "relationship_notes": [
          "用户主动分享个人喜好",
          "测试小芮嫣的记忆能力"
        ]
      },
      "relationship_stage": "warming",
      "total_messages": 6,
      "updated_at": "2026-03-31T03:58:56.172+00:00",
      "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
    },
    "summaries": [
      {
        "id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "导入的对话记录 (4 条消息)",
        "topics": null,
        "started_at": "2026-03-31T04:11:14.667392+00:00",
        "last_message_at": "2026-03-31T04:11:14.667392+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      },
      {
        "id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户分享了个人喜好和周末习惯,提到最喜欢的花是流星兰,周末常去海边散步。小芮嫣记住了这些信息。",
        "topics": [
          "喜好的花",
          "周末活动",
          "海边散步"
        ],
        "started_at": "2026-03-31T04:01:02.786762+00:00",
        "last_message_at": "2026-03-31T03:59:37.598+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      },
      {
        "id": "ea752f7a-5850-4775-bad3-cee1b21655f3",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户发送了乱码或测试消息,小芮嫣简短回应询问发生了什么",
        "topics": [
          "测试消息"
        ],
        "started_at": "2026-03-31T03:28:47.475453+00:00",
        "last_message_at": "2026-03-31T03:26:23.766+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      }
    ]
  },
  "firstChat": {
    "reply": "meteor-orchid-mne3kb80",
    "memory_context": {
      "memories": [],
      "user_profile": "喜欢流星兰,周末喜欢去海边散步放松"
    },
    "has_marker_in_memory_context": false
  },
  "pollAttempts": 1,
  "afterFollowupATotal": {
    "total": 5,
    "memories": [
      {
        "id": "87237673-98f8-4f3b-ad4f-fe9a8957b0db",
        "content": "周末习惯在海边散步",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "created_at": "2026-03-31T04:11:40.030904+00:00",
        "updated_at": "2026-03-31T04:11:40.030904+00:00"
      },
      {
        "id": "8885a884-e7ed-486f-8c6d-1cb535e66206",
        "content": "最喜欢的花是meteor-orchid-mne3kb80",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "created_at": "2026-03-31T04:11:39.49716+00:00",
        "updated_at": "2026-03-31T04:11:39.49716+00:00"
      },
      {
        "id": "d313c9d4-b745-4d1c-9f27-f88dac87ce54",
        "content": "用户分享了个人喜好,小芮嫣记住了流星兰这个名字",
        "memory_type": "shared_event",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.439417+00:00",
        "updated_at": "2026-03-31T04:01:26.439417+00:00"
      },
      {
        "id": "94a54642-8078-46d9-9029-3a4b2515657d",
        "content": "周末常去海边散步",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.020458+00:00",
        "updated_at": "2026-03-31T04:01:26.020458+00:00"
      },
      {
        "id": "5a5e1693-df9a-43a2-baca-cdd7b79bc714",
        "content": "最喜欢的花是流星兰",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:25.544782+00:00",
        "updated_at": "2026-03-31T04:01:25.544782+00:00"
      }
    ]
  },
  "afterFollowupAMarker": {
    "total": 1,
    "memories": [
      {
        "id": "8885a884-e7ed-486f-8c6d-1cb535e66206",
        "content": "最喜欢的花是meteor-orchid-mne3kb80",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "created_at": "2026-03-31T04:11:39.49716+00:00",
        "updated_at": "2026-03-31T04:11:39.49716+00:00"
      }
    ]
  },
  "adminAfterFollowupA": {
    "total": 5,
    "profile": {
      "id": "5d2c3e3f-704a-42a1-b504-a715f7dc6d18",
      "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
      "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
      "profile_data": {
        "facts": [
          "最喜欢的花是meteor-orchid-mne3kb80",
          "周末习惯在海边散步"
        ],
        "anchors": [
          "meteor-orchid-mne3kb80",
          "海边散步",
          "喜好",
          "生活习惯",
          "周末活动",
          "最喜欢的花是meteor-orchid-mne3kb80",
          "周末习惯在海边散步",
          "My",
          "favorite",
          "flower"
        ],
        "summary": "喜欢meteor-orchid-mne3kb80,周末喜欢在海边散步",
        "preferences": [
          "喜欢meteor-orchid-mne3kb80",
          "喜欢海边散步"
        ],
        "recent_topics": [
          "喜欢的花",
          "周末活动"
        ],
        "relationship_notes": [
          "用户开始分享个人喜好和生活习惯"
        ]
      },
      "relationship_stage": "warming",
      "total_messages": 6,
      "updated_at": "2026-03-31T04:09:09.776+00:00",
      "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
    },
    "summaries": [
      {
        "id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户分享了自己最喜欢的花是meteor-orchid-mne3kb80,周末习惯在海边散步。小芮嫣记住了这些信息。",
        "topics": [
          "喜好",
          "生活习惯",
          "周末活动"
        ],
        "started_at": "2026-03-31T04:11:14.667392+00:00",
        "last_message_at": "2026-03-31T04:09:01.515+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      },
      {
        "id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户分享了个人喜好和周末习惯,提到最喜欢的花是流星兰,周末常去海边散步。小芮嫣记住了这些信息。",
        "topics": [
          "喜好的花",
          "周末活动",
          "海边散步"
        ],
        "started_at": "2026-03-31T04:01:02.786762+00:00",
        "last_message_at": "2026-03-31T03:59:37.598+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      },
      {
        "id": "ea752f7a-5850-4775-bad3-cee1b21655f3",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户发送了乱码或测试消息,小芮嫣简短回应询问发生了什么",
        "topics": [
          "测试消息"
        ],
        "started_at": "2026-03-31T03:28:47.475453+00:00",
        "last_message_at": "2026-03-31T03:26:23.766+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      }
    ]
  },
  "secondChat": {
    "reply": "meteor-orchid-mne3kb80",
    "memory_context": {
      "memories": [
        {
          "id": "8885a884-e7ed-486f-8c6d-1cb535e66206",
          "content": "最喜欢的花是meteor-orchid-mne3kb80",
          "memory_type": "user_fact",
          "similarity_score": 0.135058019609988,
          "reranker_score": 1,
          "final_rank": 1
        }
      ],
      "user_profile": "喜欢meteor-orchid-mne3kb80,周末喜欢在海边散步"
    },
    "has_marker_in_memory_context": true
  },
  "finalATotal": {
    "total": 5,
    "memories": [
      {
        "id": "87237673-98f8-4f3b-ad4f-fe9a8957b0db",
        "content": "周末习惯在海边散步",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "created_at": "2026-03-31T04:11:40.030904+00:00",
        "updated_at": "2026-03-31T04:11:40.030904+00:00"
      },
      {
        "id": "8885a884-e7ed-486f-8c6d-1cb535e66206",
        "content": "最喜欢的花是meteor-orchid-mne3kb80",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "created_at": "2026-03-31T04:11:39.49716+00:00",
        "updated_at": "2026-03-31T04:11:39.49716+00:00"
      },
      {
        "id": "d313c9d4-b745-4d1c-9f27-f88dac87ce54",
        "content": "用户分享了个人喜好,小芮嫣记住了流星兰这个名字",
        "memory_type": "shared_event",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.439417+00:00",
        "updated_at": "2026-03-31T04:01:26.439417+00:00"
      },
      {
        "id": "94a54642-8078-46d9-9029-3a4b2515657d",
        "content": "周末常去海边散步",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:26.020458+00:00",
        "updated_at": "2026-03-31T04:01:26.020458+00:00"
      },
      {
        "id": "5a5e1693-df9a-43a2-baca-cdd7b79bc714",
        "content": "最喜欢的花是流星兰",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "created_at": "2026-03-31T04:01:25.544782+00:00",
        "updated_at": "2026-03-31T04:01:25.544782+00:00"
      }
    ]
  },
  "finalBTotal": {
    "total": 0,
    "memories": []
  },
  "finalAMarker": {
    "total": 1,
    "memories": [
      {
        "id": "8885a884-e7ed-486f-8c6d-1cb535e66206",
        "content": "最喜欢的花是meteor-orchid-mne3kb80",
        "memory_type": "user_fact",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "persona_name": "小芮嫣",
        "source_session_id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "created_at": "2026-03-31T04:11:39.49716+00:00",
        "updated_at": "2026-03-31T04:11:39.49716+00:00"
      }
    ]
  },
  "finalBMarker": {
    "total": 0,
    "memories": []
  },
  "adminFinalA": {
    "total": 5,
    "profile": {
      "id": "5d2c3e3f-704a-42a1-b504-a715f7dc6d18",
      "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
      "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
      "profile_data": {
        "facts": [
          "最喜欢的花是meteor-orchid-mne3kb80",
          "周末习惯在海边散步"
        ],
        "anchors": [
          "meteor-orchid-mne3kb80",
          "海边散步",
          "喜好",
          "生活习惯",
          "周末活动",
          "最喜欢的花是meteor-orchid-mne3kb80",
          "周末习惯在海边散步",
          "My",
          "favorite",
          "flower"
        ],
        "summary": "喜欢meteor-orchid-mne3kb80,周末喜欢在海边散步",
        "preferences": [
          "喜欢meteor-orchid-mne3kb80",
          "喜欢海边散步"
        ],
        "recent_topics": [
          "喜欢的花",
          "周末活动"
        ],
        "relationship_notes": [
          "用户开始分享个人喜好和生活习惯"
        ]
      },
      "relationship_stage": "warming",
      "total_messages": 6,
      "updated_at": "2026-03-31T04:09:09.776+00:00",
      "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
    },
    "summaries": [
      {
        "id": "ff55c4d3-a467-4cab-b3cf-61e3e4b8f693",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户分享了自己最喜欢的花是meteor-orchid-mne3kb80,周末习惯在海边散步。小芮嫣记住了这些信息。",
        "topics": [
          "喜好",
          "生活习惯",
          "周末活动"
        ],
        "started_at": "2026-03-31T04:11:14.667392+00:00",
        "last_message_at": "2026-03-31T04:09:23.186+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      },
      {
        "id": "ec4f535b-c302-46b8-8133-fc3ea1a3d03d",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户分享了个人喜好和周末习惯,提到最喜欢的花是流星兰,周末常去海边散步。小芮嫣记住了这些信息。",
        "topics": [
          "喜好的花",
          "周末活动",
          "海边散步"
        ],
        "started_at": "2026-03-31T04:01:02.786762+00:00",
        "last_message_at": "2026-03-31T03:59:37.598+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      },
      {
        "id": "ea752f7a-5850-4775-bad3-cee1b21655f3",
        "user_id": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "persona_id": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "status": "active",
        "summary": "用户发送了乱码或测试消息,小芮嫣简短回应询问发生了什么",
        "topics": [
          "测试消息"
        ],
        "started_at": "2026-03-31T03:28:47.475453+00:00",
        "last_message_at": "2026-03-31T03:26:23.766+00:00",
        "ended_at": null,
        "character_id": "67e1ca2c-13b9-4ea7-8c34-399085ef05ab"
      }
    ]
  },
  "adminFinalB": {
    "total": 0,
    "profile": null,
    "summaries": []
  },
  "adminSearchA": [
    {
      "memory": {
        "id": "8885a884-e7ed-486f-8c6d-1cb535e66206",
        "userId": "359acbd5-9490-4340-9a5d-01b94ef233b2",
        "personaId": "f9287933-a9e8-44c5-9c71-591e5449372e",
        "memoryType": "user_fact",
        "content": "最喜欢的花是meteor-orchid-mne3kb80",
        "importance": 0.7,
        "sourceSessionId": null,
        "embedding": null,
        "createdAt": "2026-03-31T04:11:39.49716+00:00",
        "updatedAt": "2026-03-31T04:11:39.49716+00:00",
        "similarityScore": 0.116481456651731,
        "rerankerScore": 1,
        "finalRank": 1
      },
      "similarity_score": 0.116481456651731,
      "reranker_score": 1,
      "final_rank": 1
    }
  ],
  "adminSearchB": []
}
```

## Verdict

- Import auto-persisted immediately: PASS
- First post-import chat retrieved imported memory in memory_context: FAIL
- Memory rows eventually persisted after follow-up chat: PASS
- Profile/summary eventually persisted after follow-up chat: FAIL
- Character isolation remained intact: PASS

## Interpretation

- The import flow now creates long-term memory rows immediately.
- The first chat after import still retrieves old context: imported content is absent from memory_context.
- Follow-up chat eventually created memory rows in the memories list.
- Follow-up chat did not update profile or session summary either.
- Imported content stayed isolated to Character A in this run.

