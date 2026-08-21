# 1. ビルド用の環境（Java 17）を用意
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
# Windowsで作成されたファイルでも動くように権限を付与
RUN chmod +x ./gradlew
# テストをスキップしてjarファイルを作成
RUN ./gradlew build -x test

# 2. 実行用の環境（軽量なJava 17）を用意
FROM eclipse-temurin:21-jre
WORKDIR /app
# Gradleの場合は「build/libs」の下にjarが作られるので、それをコピー
COPY --from=build /app/build/libs/*.jar app.jar
# Renderが使うポートを開放
EXPOSE 8080
# メモリ制限をかけてアプリを起動
ENTRYPOINT ["java", "-Xmx256m", "-jar", "app.jar"]