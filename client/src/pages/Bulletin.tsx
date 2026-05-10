import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Plus, Send, Trash2, ChevronDown, ChevronUp, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { PostWithComments } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Bulletin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPostAuthor, setNewPostAuthor] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, { author: string; content: string }>>({});

  const { data: posts, isLoading } = useQuery<PostWithComments[]>({
    queryKey: [api.posts.list.path],
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(api.posts.create.method, api.posts.create.path, {
        authorName: newPostAuthor,
        title: newPostTitle,
        content: newPostContent,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.posts.list.path] });
      toast({ title: "게시글 작성 완료", description: "새 게시글이 등록되었습니다." });
      setNewPostAuthor("");
      setNewPostTitle("");
      setNewPostContent("");
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: number) => {
      await apiRequest(api.posts.delete.method, api.posts.delete.path.replace(':id', String(postId)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.posts.list.path] });
      toast({ title: "게시글 삭제 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const createComment = useMutation({
    mutationFn: async ({ postId, authorName, content }: { postId: number; authorName: string; content: string }) => {
      const res = await apiRequest(
        api.comments.create.method,
        api.comments.create.path.replace(':postId', String(postId)),
        { authorName, content }
      );
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.posts.list.path] });
      setCommentInputs(prev => ({ ...prev, [variables.postId]: { author: "", content: "" } }));
      toast({ title: "댓글 작성 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest(api.comments.delete.method, api.comments.delete.path.replace(':id', String(commentId)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.posts.list.path] });
      toast({ title: "댓글 삭제 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmitComment = (postId: number) => {
    const input = commentInputs[postId];
    if (input?.author?.trim() && input?.content?.trim()) {
      createComment.mutate({ postId, authorName: input.author.trim(), content: input.content.trim() });
    }
  };

  const getCommentInput = (postId: number) => {
    return commentInputs[postId] || { author: "", content: "" };
  };

  const updateCommentInput = (postId: number, field: 'author' | 'content', value: string) => {
    setCommentInputs(prev => ({
      ...prev,
      [postId]: { ...getCommentInput(postId), [field]: value }
    }));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-display font-bold">Bulletin</h1>
            <p className="text-muted-foreground">자유롭게 글을 남겨주세요</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-post">
                <Plus className="w-4 h-4 mr-2" />
                글쓰기
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>새 게시글 작성</DialogTitle>
                <DialogDescription>누구나 자유롭게 글을 작성할 수 있습니다.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Input
                    placeholder="작성자 이름"
                    value={newPostAuthor}
                    onChange={(e) => setNewPostAuthor(e.target.value)}
                    data-testid="input-post-author"
                  />
                </div>
                <div>
                  <Input
                    placeholder="제목"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    data-testid="input-post-title"
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="내용을 입력하세요..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    rows={5}
                    data-testid="input-post-content"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createPost.mutate()}
                  disabled={!newPostAuthor.trim() || !newPostTitle.trim() || !newPostContent.trim() || createPost.isPending}
                  data-testid="button-submit-post"
                >
                  {createPost.isPending ? "작성 중..." : "게시하기"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => {
              const isExpanded = expandedPostId === post.id;
              const commentInput = getCommentInput(post.id);
              
              return (
                <Card key={post.id} className="p-0 overflow-hidden" data-testid={`post-item-${post.id}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{post.authorName}</div>
                            <div className="text-xs text-muted-foreground">
                              {post.createdAt && format(new Date(post.createdAt), "yyyy.MM.dd HH:mm")}
                            </div>
                          </div>
                        </div>
                        <h3 className="font-bold text-lg mb-2">{post.title}</h3>
                        <p className="text-muted-foreground whitespace-pre-wrap">{post.content}</p>
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground shrink-0"
                            data-testid={`button-delete-post-${post.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>게시글 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              정말 이 게시글을 삭제하시겠습니까? 댓글도 함께 삭제됩니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePost.mutate(post.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="border-t">
                    <button
                      onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm text-muted-foreground hover-elevate"
                      data-testid={`button-toggle-comments-${post.id}`}
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        댓글 {post.comments.length}개
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 space-y-4">
                        {post.comments.length > 0 && (
                          <div className="space-y-3">
                            {post.comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30"
                                data-testid={`comment-item-${comment.id}`}
                              >
                                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                  <User className="w-3 h-3 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{comment.authorName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {comment.createdAt && format(new Date(comment.createdAt), "MM.dd HH:mm")}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="shrink-0 h-6 w-6"
                                  onClick={() => deleteComment.mutate(comment.id)}
                                  data-testid={`button-delete-comment-${comment.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col gap-2 pt-2 border-t">
                          <Input
                            placeholder="이름"
                            value={commentInput.author}
                            onChange={(e) => updateCommentInput(post.id, 'author', e.target.value)}
                            className="text-sm"
                            data-testid={`input-comment-author-${post.id}`}
                          />
                          <div className="flex gap-2">
                            <Input
                              placeholder="댓글을 입력하세요..."
                              value={commentInput.content}
                              onChange={(e) => updateCommentInput(post.id, 'content', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSubmitComment(post.id);
                                }
                              }}
                              className="flex-1 text-sm"
                              data-testid={`input-comment-content-${post.id}`}
                            />
                            <Button
                              size="icon"
                              onClick={() => handleSubmitComment(post.id)}
                              disabled={!commentInput.author?.trim() || !commentInput.content?.trim() || createComment.isPending}
                              data-testid={`button-submit-comment-${post.id}`}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">아직 게시글이 없습니다</h3>
            <p className="text-muted-foreground mb-4">첫 번째 게시글을 작성해보세요!</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-post">
              <Plus className="w-4 h-4 mr-2" />
              글쓰기
            </Button>
          </Card>
        )}
      </div>
    </Layout>
  );
}
