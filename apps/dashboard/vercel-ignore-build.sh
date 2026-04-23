echo "Branch: $VERCEL_GIT_COMMIT_REF"

if [ "$VERCEL_GIT_COMMIT_REF" = "main" ] || [ "$VERCEL_GIT_COMMIT_REF" = "dev" ]; then
  echo "Build allowed"
  exit 1
fi

echo "Build ignored"
exit 0