from fastapi import HTTPException, status


class EntityNotFoundException(HTTPException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class UnauthorizedException(HTTPException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions to perform this action"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ConflictException(HTTPException):
    def __init__(self, detail: str = "Resource already exists or state conflict"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class BlockchainException(HTTPException):
    def __init__(self, detail: str = "Blockchain interaction failed"):
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

