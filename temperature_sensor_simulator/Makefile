DOCKER_IMAGE_VERSION=1.0
DOCKER_IMAGE_NAME=iofog/temperature-sensor-simulator
DOCKER_IMAGE_NAME_ARM=iofog/temperature-sensor-simulator-arm
DOCKER_IMAGE_TAGNAME=$(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_VERSION)
DOCKER_IMAGE_TAGNAME_ARM=$(DOCKER_IMAGE_NAME_ARM):$(DOCKER_IMAGE_VERSION)

default: build

build:
	docker build -t $(DOCKER_IMAGE_TAGNAME) .
	docker tag $(DOCKER_IMAGE_TAGNAME) $(DOCKER_IMAGE_NAME):latest

push:build
	docker push $(DOCKER_IMAGE_TAGNAME)
	docker push $(DOCKER_IMAGE_NAME)

## Same cmds for arm
build-arm:
	docker build -t $(DOCKER_IMAGE_TAGNAME_ARM) -f Dockerfile-arm .
	docker tag $(DOCKER_IMAGE_TAGNAME_ARM) $(DOCKER_IMAGE_NAME_ARM):latest
push-arm:build-arm
	docker push $(DOCKER_IMAGE_TAGNAME_ARM)
	docker push $(DOCKER_IMAGE_NAME_ARM)